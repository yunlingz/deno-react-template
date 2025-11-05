# Oauth2 Server & Client impl

Run steps:
1. install [devtunnel](https://learn.microsoft.com/en-us/azure/developer/dev-tunnels/overview)
2. start devtunnel proxy to oauth2 server: `devtunnel host -p 21000 --allow-anonymous`, update the URL to `.env.base` > `OAUTH2_SERVER_BASE_URL`.
3. start devtunnel proxy to oauth2 client + Web UI: `devtunnel host -p 14000 --allow-anonymous`, update the URL to `.env.base` > `OAUTH2_CLIENT_BASE_URL`.
4. start both oauth2 server and oauth2 client: `deno run dev` (watch mode) or `deno run prod`.
5. Visit the devtunnel proxy to oauth2 client URL to expreience the flow of oauth2. The oauth2 server side has a built-in account (username: `username-0000`, password: `password-0000`).