# Circuit and Grain

React request form and private admin dashboard, backed by a Cloudflare Worker and D1. No .NET backend is needed.

## Local development

Run npm install, then npm run dev to inspect the interface. All request data, submissions and authentication use the real same-origin Worker API. There is no local data or login bypass. Use npm run worker:dev for Worker-backed development with configured bindings and secrets; real identity/Turnstile/mail services must be configured for their features to work.

## Existing database

Database `circuitgrain-access`, ID `53695b42-59f9-4e1d-a045-954d7a8e2940` is configured locally. The app matches the user-created requests/audit_log tables, integer IDs, lowercase statuses and reason field. Before live use, apply the configured additive migrations under **schema-upgrades**. Read **DATABASE-SETUP.md** for the exact command and compatibility assumptions. Do not apply the original migrations folder to this database.

One record is retained per email address, matching the existing UNIQUE constraint. Duplicate submissions do not overwrite previous decisions. Use Reapprove to restore access.

## Production settings

1. Apply the additive D1 upgrade from DATABASE-SETUP.md.
2. The admin/request custom domains are configured in wrangler.jsonc. Keep workers.dev and preview URLs disabled.
3. Configure direct Google sign-in as described in GOOGLE-SIGNIN.md. The Worker protects private APIs itself; no Cloudflare Access application is required.
4. Register https://admin.circuitgrain.shop/auth/google/callback with the supplied Google Web application client. Add GOOGLE_CLIENT_SECRET and ADMIN_SESSION_SECRET as Worker secrets. See GOOGLE-SIGNIN.md for exact settings.
5. Add a Turnstile widget for the deployed hostname and put its site key in TURNSTILE_SITE_KEY. Store the secret with `node ./node_modules/wrangler/bin/wrangler.js secret put TURNSTILE_SECRET_KEY`.
6. Verify your sender domain in Resend; set EMAIL_FROM to a verified sender and store the sending API key with `node ./node_modules/wrangler/bin/wrangler.js secret put RESEND_API_KEY`. Administrator notifications go to dnyaneshwar@circuitgrain.shop and retry through the D1 outbox every five minutes, up to twelve attempts within 23 hours.
7. `npm run deploy` builds and deploys the Worker. Review **EMAIL-REQUESTS.md** before activating inbound email routing. The configured inbound recipient is dnyaneshwar@circuitgrain.shop and the verified forwarding destination is insanedk46@gmail.com. Forwarding and live settings are not activated by local file changes.

## Workflow and security

The public form accepts email and reason. The Worker validates input, origin, a honeypot and server-side Turnstile including action/hostname. New records begin pending; the UI displays Pending. Approve, reject, revoke and reapprove operations use optimistic versions and write audit entries atomically. Rejection/revocation require a note. APIs verify the signed administrator session and the current server-side allowlist. Google identity tokens are verified on the OAuth callback. UI state never grants API access. Incoming mail is subject-filtered and authenticated; see EMAIL-REQUESTS.md. Notification failures never delete a request.

Client search/filter/sort/pagination operates on the loaded dataset. Approval records the decision; any separate private product must check approved status to actually grant access. Existing mailbox history is not imported.

## Checks

`npm test`, `python tests/existing_schema_check.py`, `npm run build`. A Worker dry run uses `node ./node_modules/wrangler/bin/wrangler.js deploy --dry-run`.

Generated cover assets and prompts are documented in COVER-ART.md and ADMIN-COVER-ART.md.

## References

- https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/google/
- https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- https://developers.cloudflare.com/email-service/api/route-emails/email-handler/
- https://resend.com/docs/api-reference/emails/send-email

## Timed website access

Approval now requires an expiry and queues a one-time applicant link. Apply only the new schema-upgrades/0002_timed_access.sql after the already-applied base upgrade. Set the same ACCESS_LINK_SECRET on cg-admin and ecommerceclient. See C:\GitHub\eCommerceClient\eCommerce.Client\worker\ACCESS-GATE.md for the full activation and verification steps. The main website gate is independent of .NET and Cloudflare Access; admin sign-in remains separate. These local changes do not deploy the gate or alter the remote database.
