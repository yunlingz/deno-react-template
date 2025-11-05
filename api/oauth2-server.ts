import { Hono } from "hono";
import { cors } from "hono/cors";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

const app = new Hono();
app.use(cors());

const USERNAME = "user";
const PASSWORD = "pass";

const clients = new Map<
  string,
  { client_secret: string; redirect_uri: string }
>([
  ["client123", {
    client_secret: "secret123",
    redirect_uri: "http://localhost:5173/callback",
  }],
]);

const codes = new Map<
  string,
  { client_id: string; username: string; state: string }
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
    redirect_uri !== client.redirect_uri
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
  if (
    !client ||
    redirect_uri !== client.redirect_uri ||
    username !== USERNAME ||
    password !== PASSWORD
  ) {
    return c.text("Invalid credentials or client", 400);
  }

  const code = crypto.randomUUID();
  codes.set(code, { client_id, username, state });

  const url = new URL(redirect_uri);
  url.searchParams.set("code", code);
  url.searchParams.set("state", state);
  return c.redirect(url.toString());
});

app.post("/oauth/token", async (c) => {
  const body = filterStrings(await c.req.parseBody());
  const { grant_type, code, client_id, client_secret, redirect_uri } = body;
  const client = clients.get(client_id);
  if (
    grant_type !== "authorization_code" ||
    !client ||
    client_secret !== client.client_secret ||
    redirect_uri !== client.redirect_uri ||
    !codes.has(code)
  ) {
    return c.json({ error: "invalid_grant" }, 400);
  }
  const { username } = codes.get(code)!;
  codes.delete(code);

  const now = Math.floor(Date.now() / 1000);
  const access_token = crypto.randomUUID();
  const id_token = await new SignJWT({
    sub: username,
    iss: "http://localhost:8000",
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

if (import.meta.main) {
  Deno.serve({ hostname: "127.0.0.1", port: 21000 }, app.fetch);
}
