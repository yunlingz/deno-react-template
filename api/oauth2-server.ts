import { Hono } from "hono";
import { cors } from "hono/cors";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { parseArgs } from "@std/cli/parse-args";
import * as z from "zod";
import * as R from "remeda";

const flagsSchema = z.object({
  "client-id": z.string(),
  "client-secret": z.string(),
  "redirect-uri": z.url(),
  "stored-username": z.string(),
  "stored-password": z.string(),
  "base-uri": z.url(),
});
type Flags = z.infer<typeof flagsSchema>;

let flags: Flags;
try {
  flags = flagsSchema.parse(parseArgs(Deno.args, {
    string: [
      "client-id",
      "client-secret",
      "redirect-uri",
      "stored-username",
      "stored-password",
      "base-uri",
    ],
    default: {
      "client-id": "client-id-0000",
      "client-secret": "client-secret-0000",
      "stored-username": "username-0000",
      "stored-password": "password-0000",
    },
  }));
} catch (error) {
  console.error("Error parsing command line arguments:", error);
  Deno.exit(1);
}

console.log("Using flags:", flags);

const app = new Hono();
app.use(cors());

const users = new Map<
  string,
  { username: string; password: string; avatar: string }
>([
  [crypto.randomUUID(), {
    username: flags["stored-username"],
    password: flags["stored-password"],
    avatar: "\u{1F97A}",
  }],
]);
// make sure userID <-> username in bijection
if (
  new Set(Array.from(users.values()).map((u) => u.username)).size !== users.size
) {
  console.error("Usernames must be unique");
  Deno.exit(1);
}

const clients = new Map<
  string,
  { clientSecret: string; redirectUri: string }
>([
  [flags["client-id"], {
    clientSecret: flags["client-secret"],
    redirectUri: flags["redirect-uri"],
  }],
]);

const codes = new Map<
  string,
  {
    clientId: string;
    userId: string;
    redirectUri: string;
    state: string;
    expiresAt: number;
  }
>();

const { publicKey, privateKey } = await generateKeyPair("ES256");
const kid = crypto.randomUUID();
const publicJwk = await exportJWK(publicKey);
publicJwk.kid = kid;

app.get("/oauth/authorize", (c) => {
  const { response_type, client_id, redirect_uri, state } = c.req.query();
  const client = clients.get(client_id);
  if (
    response_type !== "code" ||
    !client ||
    redirect_uri !== client.redirectUri
  ) {
    return c.text("Invalid client or params", 400);
  }

  return c.html(`
<html>
  <head>
    <title>OAuth2 Login</title>
    <style>
      html, body {
        height: 100%;
        margin: 0;
        padding: 0;
      }
      body {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #181818;
        font-family: system-ui, sans-serif;
        color: #f3f4f6;
      }
      .login-container {
        background: #2b2b2b;
        padding: 2.5rem 2rem;
        border-radius: 10px;
        box-shadow: 0 2px 16px rgba(0, 0, 0, 0.25);
        min-width: 320px;
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .login-container h2 {
        margin-bottom: 1.5rem;
        color: #f3f4f6;
      }
      .login-container form {
        display: flex;
        flex-direction: column;
        width: 100%;
        gap: 1rem;
      }
      .login-container input[type="text"],
      .login-container input[type="password"] {
        padding: 0.75rem;
        border: 1px solid #3f3f46;
        border-radius: 6px;
        font-size: 1rem;
        width: 100%;
        background: #18181b;
        color: #f3f4f6;
        outline: none;
        transition: border 0.2s;
      }
      .login-container input[type="text"]:focus,
      .login-container input[type="password"]:focus {
        border: 1.5px solid #6366f1;
      }
      .login-container button {
        padding: 0.75rem;
        background: #6366f1;
        color: #fff;
        border: none;
        border-radius: 6px;
        font-size: 1rem;
        cursor: pointer;
        transition: background 0.2s;
      }
      .login-container button:hover {
        background: #4f46e5;
      }
    </style>
  </head>
  <body>
    <div class="login-container">
      <h2>OAuth2 Login</h2>
      <form method="POST" action="/oauth/authorize">
        <input type="hidden" name="client_id" value="${client_id}" />
        <input type="hidden" name="redirect_uri" value="${redirect_uri}" />
        <input type="hidden" name="state" value="${state}" />
        <input
          type="text"
          name="username"
          placeholder="Username"
          required
          autofocus
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          required
        />
        <button type="submit">Login</button>
      </form>
    </div>
  </body>
</html>
  `);
});

const filterStrings = (
  body: Record<string, string | File>,
): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const key in body) {
    if (typeof body[key] === "string") {
      result[key] = body[key];
    }
  }
  return result;
};

app.post("/oauth/authorize", async (c) => {
  const body = filterStrings(await c.req.parseBody());
  const { client_id, redirect_uri, state, username, password } = body;
  const client = clients.get(client_id);
  const userEntry = R.pipe(
    Array.from(users.entries()),
    (entries) => entries.find(([_id, u]) => u.username === username),
  ); // userID <-> username already bijection
  if (
    !client ||
    redirect_uri !== client.redirectUri ||
    !userEntry ||
    password !== userEntry[1].password
  ) {
    return c.html(
      `
<html>
  <head>
    <title>Login Failed</title>
    <style>
      html, body {
        height: 100%;
        margin: 0;
        padding: 0;
      }
      body {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #181818;
        font-family: system-ui, sans-serif;
        color: #f3f4f6;
      }
      .error-container {
        background: #2b2b2b;
        padding: 2.5rem 2rem;
        border-radius: 10px;
        box-shadow: 0 2px 16px rgba(0, 0, 0, 0.25);
        min-width: 320px;
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .error-container h1 {
        color: #f65c5c;
        margin-bottom: 1rem;
      }
      .error-container p {
        margin-bottom: 1.5rem;
        color: #f3f4f6;
      }
      .error-container a {
        display: inline-block;
        padding: 0.75rem 1.5rem;
        background: #6366f1;
        color: #fff;
        border-radius: 6px;
        text-decoration: none;
        font-size: 1rem;
        transition: background 0.2s;
      }
      .error-container a:hover {
        background: #4f46e5;
      }
    </style>
  </head>
  <body>
    <div class="error-container">
      <h1>Login Failed</h1>
      <p>Invalid credentials or client information.</p>
      <a
        href="/oauth/authorize?response_type=code&client_id=${
        encodeURIComponent(client_id)
      }&redirect_uri=${encodeURIComponent(redirect_uri)}&state=${
        encodeURIComponent(state)
      }"
      >Try Again</a>
    </div>
  </body>
</html>
      `,
      400,
    );
  }

  const code = crypto.randomUUID();
  codes.set(code, {
    clientId: client_id,
    userId: userEntry[0],
    redirectUri: redirect_uri,
    state,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });

  const url = new URL(redirect_uri);
  url.searchParams.set("code", code);
  url.searchParams.set("state", state);
  return c.redirect(url.toString());
});

const accessTokenStore = new Map<
  string,
  { userId: string; expiresAt: number }
>();

app.post("/oauth/token", async (c) => {
  const body = filterStrings(await c.req.parseBody());
  const { grant_type, code, client_id, client_secret, redirect_uri } = body;
  const client = clients.get(client_id);
  const codeEntry = codes.get(code);

  if (
    grant_type !== "authorization_code" ||
    !client ||
    client_secret !== client.clientSecret ||
    !codeEntry ||
    redirect_uri !== codeEntry.redirectUri ||
    codeEntry.expiresAt < Date.now()
  ) {
    return c.json({ error: "invalid_grant: parameters are invalid" }, 400);
  }

  const { userId } = codeEntry;
  codes.delete(code);
  const user = users.get(userId);
  if (!user) {
    return c.json({ error: "invalid_grant: user not found" }, 400);
  }

  const now = Math.floor(Date.now() / 1000);

  const access_token = crypto.randomUUID();
  accessTokenStore.set(access_token, {
    userId,
    expiresAt: Date.now() + 3600 * 1000, // 1h
  });

  const id_token = await new SignJWT({
    sub: userId,
    iss: flags["base-uri"],
    aud: client_id,
    iat: now,
    exp: now + 3600,
  })
    .setProtectedHeader({ alg: "ES256", kid })
    .sign(privateKey);

  return c.json({
    access_token,
    id_token,
    token_type: "Bearer",
    expires_in: 3600,
  });
});

app.get("/.well-known/jwks.json", (c) => {
  return c.json({ keys: [publicJwk] });
});

app.get("/.well-known/openid-configuration", (c) => {
  const base = flags["base-uri"].replace(/\/$/, "");
  return c.json({
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    jwks_uri: `${base}/.well-known/jwks.json`,
    response_types_supported: ["code"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["ES256"],
    scopes_supported: ["openid", "profile"],
    token_endpoint_auth_methods_supported: ["client_secret_post"],
    claims_supported: ["sub", "iss", "aud", "exp", "iat"],
    grant_types_supported: ["authorization_code"],
  });
});

app.get("/protected-api/profile", (c) => {
  const auth = c.req.header("authorization");
  if (!auth || !auth.startsWith("Bearer ")) {
    return c.json({ error: "missing_token" }, 401);
  }
  const token = auth.slice("Bearer ".length);

  const tokenInfo = accessTokenStore.get(token);
  if (!tokenInfo) {
    return c.json({ error: "invalid_token" }, 401);
  }
  if (tokenInfo.expiresAt < Date.now()) {
    accessTokenStore.delete(token);
    return c.json({ error: "expired_token" }, 401);
  }

  const user = users.get(tokenInfo.userId);
  if (!user) {
    return c.json({ error: "user_not_found" }, 401);
  }
  return c.json({
    username: user.username,
    avatar: user.avatar,
  });
});

if (import.meta.main) {
  Deno.serve({ hostname: "127.0.0.1", port: 21000 }, app.fetch);
}
