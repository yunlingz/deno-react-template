import { Hono } from "hono";
import { serveStatic } from "hono/deno";
import { getCookie, setCookie } from "hono/cookie";
import { cors } from "hono/cors";
import { env } from "../parse-env.ts";
import * as z from "zod";
import { createRemoteJWKSet, jwtVerify } from "jose";

const app = new Hono();

const OPENID_CONFIG_SCHEMA = z.object({
  issuer: z.url(),
  authorization_endpoint: z.url(),
  token_endpoint: z.url(),
  jwks_uri: z.url(),
});

const OPENID_CONFIG = await fetch(
  `${env().OAUTH2_SERVER_BASE_URL}/.well-known/openid-configuration`,
).then(async (res) => {
  if (!res.ok) {
    throw new Error(
      `Failed to fetch OpenID configuration: ${res.status} ${res.statusText}`,
    );
  }
  const parsed = await res.json();
  return OPENID_CONFIG_SCHEMA.parse(parsed);
});

const JWKS = createRemoteJWKSet(new URL(OPENID_CONFIG.jwks_uri));

const getRandomState = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

app.get("/api/login", (c) => {
  const state = getRandomState();
  setCookie(c, "oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
  });

  const redirectUri = `${env().OAUTH2_CLIENT_BASE_URL}/api/callback`;
  const authorizationUrl = new URL(
    OPENID_CONFIG.authorization_endpoint,
  );
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("client_id", env().OAUTH2_CLIENT_ID);
  authorizationUrl.searchParams.set("redirect_uri", redirectUri);
  authorizationUrl.searchParams.set("state", state);

  return c.redirect(authorizationUrl.toString());
});

const TOKEN_RESPONSE_SCHEMA = z.object({
  access_token: z.string(),
  id_token: z.string(),
  token_type: z.string(),
  expires_in: z.number(),
});
type TokenResponse = z.infer<typeof TOKEN_RESPONSE_SCHEMA> & {
  expires_at: number;
};
const sessionStore = new Map<string, TokenResponse>();

app.get("/api/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const storedState = getCookie(c, "oauth_state");

  if (!code || !state || !storedState || state !== storedState) {
    return c.text("Invalid state or missing code", 400);
  }

  const redirectUri = `${env().OAUTH2_CLIENT_BASE_URL}/api/callback`;
  const tokenResponse = await fetch(OPENID_CONFIG.token_endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: env().OAUTH2_CLIENT_ID,
      client_secret: env().OAUTH2_CLIENT_SECRET,
      redirect_uri: redirectUri,
    }),
  });
  if (!tokenResponse.ok) {
    return c.text(
      `Failed to exchange code for tokens: ${tokenResponse.status} ${tokenResponse.statusText}`,
      500,
    );
  }

  const tokenData = TOKEN_RESPONSE_SCHEMA.parse(
    await tokenResponse.json(),
  );

  const sessionId = crypto.randomUUID();
  sessionStore.set(sessionId, {
    ...tokenData,
    expires_at: Date.now() + tokenData.expires_in * 1000,
  });

  setCookie(c, "session_id", sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
  });

  return c.redirect("/");
});

app.get("/api/extended-profile", async (c) => {
  const sessionId = getCookie(c, "session_id");
  if (!sessionId) {
    return c.text("Not authenticated", 401);
  }

  const session = sessionStore.get(sessionId);
  if (!session) {
    return c.text("Session not found", 401);
  }
  if (session.expires_at < Date.now()) {
    sessionStore.delete(sessionId);
    return c.text("Session expired", 401);
  }

  const profileResponse = await fetch(
    `${env().OAUTH2_SERVER_BASE_URL}/protected-api/profile`,
    {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    },
  );
  if (!profileResponse.ok) {
    return c.text(
      `Failed to fetch profile: ${profileResponse.status} ${profileResponse.statusText}`,
      500,
    );
  }

  const profileData = await profileResponse.json();
  return c.json(profileData);
});

app.get("/api/id-profile", async (c) => {
  const sessionId = getCookie(c, "session_id");
  if (!sessionId) {
    return c.text("Not authenticated", 401);
  }

  const session = sessionStore.get(sessionId);
  if (!session) {
    return c.text("Session not found", 401);
  }
  if (session.expires_at < Date.now()) {
    sessionStore.delete(sessionId);
    return c.text("Session expired", 401);
  }

  try {
    const { payload, protectedHeader } = await jwtVerify(
      session.id_token,
      JWKS,
      {
        issuer: OPENID_CONFIG.issuer,
        audience: env().OAUTH2_CLIENT_ID,
      },
    );
    return c.json({
      header: protectedHeader,
      claims: payload,
    });
  } catch (error) {
    return c.text(`Failed to verify ID token: ${error}`, 500);
  }
});

if (import.meta.main) {
  switch (env().BUILD_MODE) {
    case "dev": {
      app.use(
        "*",
        cors({
          origin: `http://127.0.0.1:${env().PORT}`,
          credentials: true,
        }),
      );

      break;
    }

    case "prod": {
      app.use("/*", serveStatic({ root: "./public" }));
      app.use("/*", serveStatic({ root: "./dist" }));

      break;
    }

    default: {
      console.error("Unknown BUILD_MODE:", env().BUILD_MODE);
      Deno.exit(1);
    }
  }

  Deno.serve({ hostname: "127.0.0.1", port: env().API_PORT }, app.fetch);
}
