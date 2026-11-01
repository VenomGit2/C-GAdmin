# Incoming request emails

The Worker now supports inbound email events for `dnyaneshwar@circuitgrain.shop`. This code is not a connection to an existing inbox and does not import historical messages. No DNS, mailbox, routing rules or live deployment were changed.

## Only access requests

A new email must have an explicit subject such as **Access request**, **Request access**, **Request for access**, **Request to access**, or **Requesting access**. Matching is case-insensitive. A message that only mentions access in its body is not imported. Newsletters, receipts, passwords, ordinary conversation and other subjects stay out of D1. Automated messages, mailing lists and replies with In-Reply-To are ignored, even when the subject matches. The first Cloudflare-generated authentication result must have DMARC pass; sender-supplied authentication headers are not trusted.

The display name and email come from the MIME From header, the reason comes from the plain-text body (or inert text extracted from HTML), and the record begins Pending. Subject and source are shown in the private dashboard. Select Source > Email to list only email submissions. Re-delivery of the same message is deduplicated. Attachments are not saved; maximum incoming message size is 1 MB and stored message text is limited to 12,000 characters. Email text is rendered as escaped React text, never as HTML.

Notifications still go to dnyaneshwar@circuitgrain.shop. They carry Auto-Submitted and X-CG-Notification headers to prevent import loops. Request records and notification outbox entries are written atomically.

## Connect new email delivery

1. Identify the current hosting provider of dnyaneshwar@circuitgrain.shop first. If it is Gmail, Google Workspace, Microsoft, Zoho, Hostinger or another mailbox service, do not replace its MX records just to enable this feature. Use that provider's supported integration or a separate Cloudflare-routed inbound subdomain. A direct provider mailbox sync is not included in this implementation.
2. Apply the configured additive migrations using `node ./node_modules/wrangler/bin/wrangler.js d1 migrations apply circuitgrain-access --remote`. Read DATABASE-SETUP.md first; do not apply the original migrations folder. Existing records default to source `form`. The unique-email rule retains one request per email, including repeat incoming messages.
3. If the domain already uses Cloudflare Email Routing, keep `INBOUND_REQUEST_ADDRESS` set to dnyaneshwar@circuitgrain.shop. Set `INBOUND_FORWARD_TO` to a **different verified delivery address** for your existing mailbox, such as its actual external Gmail address. Never set it to the same receiving address or any route leading back to this Worker. Test forwarding first.
4. Deploy with `npm run deploy`, then configure the exact address in Cloudflare Email Routing to send to Worker `cg-admin`. Incoming mail will be processed by its email() handler. Forwarding is performed before request classification, so both ordinary and access-request messages can reach the verified destination.
5. Without INBOUND_FORWARD_TO, this Worker does not preserve a normal mailbox copy: non-request messages are simply not imported. Only use this mode for a dedicated ingestion-only address. Do not switch the existing personal inbox to that mode. An Email Worker does not itself provide an inbox.
6. Send a real authenticated email from an external account with subject Access request and a meaningful message. Confirm it reaches the existing inbox and appears as Pending after dashboard Refresh. Then send an unrelated subject and confirm normal delivery with no dashboard record. Redeliver a message and confirm no duplicate, and verify notification emails are not re-imported.

## Current limitations

The frontend-only development server has no incoming mailbox connection. A live Cloudflare account, configured D1, Email Routing and normal inbox destination are required. Existing messages already delivered to another provider require a separate provider API/IMAP import with the same subject rules; they cannot be recovered through Cloudflare routing alone. Ordinary emails are not copied to D1. Imported messages do not automatically grant access when approved; the private product must enforce Approved status separately.

Reference: https://developers.cloudflare.com/email-service/api/route-emails/email-handler/
