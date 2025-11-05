```
@startuml
title OAuth2 Server/Client Flow

actor User
participant "Web UI (App.tsx)" as UI
participant "OAuth2 Client (main.ts)" as Client
participant "OAuth2 Server (oauth2-server.ts)" as Server

User -> UI: Visit Web UI
UI -> Client: GET /api/id-profile & /api/extended-profile
note right of UI: UI sends session_id cookie
Client -> Client: Check sessionStore for tokens using session_id
alt Not signed in
    UI -> Client: Redirect to /api/login
    Client -> Server: GET /oauth/authorize?client_id=...&redirect_uri=...&state=...&scope=openid
    Server -> User: Show login form
    User -> Server: Submit username/password
    Server -> Server: Validate against users Map
    Server -> Server: Generate authorization code (code=abc123)
    Server -> Server: Store code in codes Map
    Server -> Client: Redirect to /api/callback?code=abc123&state=...
    Client -> Server: POST /oauth/token
    note right of Client: Body:\n grant_type=authorization_code\n code=abc123\n client_id=...\n client_secret=...\n redirect_uri=...
    Server -> Server: Validate code from codes Map
    Server -> Server: Validate client_id and client_secret against clients Map
    Server -> Server: Generate access_token (UUID, e.g. acc_456)
    Server -> Server: Store in accessTokenStore (acc_456 -> userId)
    Server -> Server: Generate id_token (JWT)
    Server -> Client: Return JSON { access_token: acc_456, id_token: ..., token_type: "Bearer", expires_in: 3600 }
    Client -> Client: Store tokens in sessionStore (session_id -> tokens)
    note right of Client: Only session_id is sent to UI as cookie
    Client -> UI: Redirect to /
end

UI -> Client: GET /api/id-profile (with session_id cookie)
Client -> Client: Get id_token from sessionStore using session_id
Client -> Server: Validate id_token with JWKS (using jose)
Server -> Server: Fetch JWKS from /.well-known/jwks.json
Server -> Client: Return decoded claims (e.g. sub, iss, aud)

UI -> Client: GET /api/extended-profile (with session_id cookie)
Client -> Client: Get access_token from sessionStore using session_id
Client -> Server: GET /api/profile with Authorization: Bearer acc_456
Server -> Server: Lookup acc_456 in accessTokenStore
Server -> Server: Get userId, fetch user info from users Map
Server -> Client: Return user profile (username, avatar, emoji)

UI -> User: Display user info (ID, username, avatar)

User -> UI: Click Logout
UI -> Client: GET /api/logout (with session_id cookie)
Client -> Client: Remove session from sessionStore
UI -> User: Show sign-in screen

@enduml
```