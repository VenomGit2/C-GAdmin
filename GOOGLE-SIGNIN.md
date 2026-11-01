# Google administrator sign-in

The admin Worker now implements direct Google OpenID Connect sign-in. Cloudflare Zero Trust/Access is not used for administrator login. The main site's separate emailed access-link gate is unchanged.

## Google Cloud settings

Open Google Auth Platform > Clients and select the existing **Web application** client:

`787849098588-ug81abf9bvgfjm67ik7dt7a3kc2psq3p.apps.googleusercontent.com`

Add this exact **Authorized redirect URI**:

```text
https://admin.circuitgrain.shop/auth/google/callback
```

No JavaScript origin is required by this server-side redirect flow. Configure the app branding/consent screen and developer contact as required by Google. Only `openid email` scopes are requested. Google's test-user list is not the administrator authorization boundary; the Worker validates the signed Google identity and then applies ADMIN_EMAILS.

## Cloudflare Worker settings

On Worker **cg-admin**, open Settings > Variables and Secrets. Add both as **Secret** values:

| Name | Value |
| --- | --- |
| GOOGLE_CLIENT_SECRET | This OAuth client's Client Secret, copied directly from Google |
| ADMIN_SESSION_SECRET | A distinct random secret of at least 32 characters, generated with a password manager |

Never paste secrets into chat, commit them, put them in frontend environment variables, or add them to wrangler.jsonc. The public Client ID, callback URI, and ADMIN_EMAILS are already in wrangler.jsonc. Keep ADMIN_SESSION_SECRET separate from ACCESS_LINK_SECRET, which signs visitor website links.

If the Worker has not been created yet, deploy this code from GitHub first, then add its secrets. Until configured, the login screen displays a friendly configuration message and protected APIs remain denied. Do not add a Cloudflare Access application in front of admin.circuitgrain.shop for this flow; any existing Access interception must be removed/reconfigured so the Google callback reaches this Worker.

## Behavior

- GET /auth/login creates a signed ten-minute HttpOnly state cookie, random state/nonce, and PKCE challenge before redirecting to Google.
- GET /auth/google/callback verifies the browser state and exchanges the one-use authorization code with Google server-to-server. Google ID-token signature, issuer, audience, expiry, nonce, email verification and authorized-party claims are validated. Tokens are never handed to React.
- Only email addresses in the server's ADMIN_EMAILS may obtain an admin session; currently insanedk46@gmail.com. The email is not hardcoded into browser code.
- The session is an eight-hour signed HttpOnly, Secure, host-only SameSite=Lax cookie scoped to admin.circuitgrain.shop. Every private API checks its signature, expiry and the current allowlist. Changing the allowlist affects subsequent API calls.
- POST /auth/logout requires the correct Origin and expires the application session cookie. It signs out of this application, not the entire Google account.
- Failed/cancelled login redirects to the login page with a fixed friendly message; OAuth codes and provider tokens are not displayed or logged by this code.

No D1 migration is needed for this administrator sign-in change. Existing database and request data remain unchanged.

## Before/after deployment

Run `npm test` and `npm run build`; use Wrangler deploy --dry-run to check bundling. Tests simulate Google/JWKS responses and never use your secret or contact your Google account. Live verification requires the configured HTTPS callback and secrets:

1. Sign in as insanedk46@gmail.com and confirm the dashboard opens.
2. Sign out and verify /api/session and /api/requests deny access.
3. Try another Google account and confirm administrator access is denied.
4. Ensure an altered/expired cookie cannot access requests.

Local frontend-only Vite development can show the form but cannot complete this production Google callback. Use the deployed admin hostname for real sign-in testing.

Reference: https://developers.google.com/identity/openid-connect/openid-connect
