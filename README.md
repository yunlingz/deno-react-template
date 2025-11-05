# Oauth2 Server & Client impl

Run steps:
1. install [devtunnel](https://learn.microsoft.com/en-us/azure/developer/dev-tunnels/overview)
2. start devtunnel proxy to oauth2 server: `devtunnel host -p 21000 --allow-anonymous`, update the URL to `.env.base` > `OAUTH2_SERVER_BASE_URL`.
2. start devtunnel proxy to oauth2 client + Web UI: `devtunnel host -p 14000 --allow-anonymous`, update the URL to `.env.base` > `OAUTH2_CLIENT_BASE_URL`.