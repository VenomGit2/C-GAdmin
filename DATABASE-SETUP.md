# Existing D1 database

**Current status:** The base admin upgrade (0001_admin_features.sql) was applied manually in the Cloudflare console and its request columns/outbox/triggers were confirmed. Do not rerun that upgrade or use Wrangler migrations apply against it without first reconciling migration tracking. The newly added 0002_timed_access.sql is still pending and must be applied once through the console. See the storefront worker/ACCESS-GATE.md for activation instructions.


Database: `circuitgrain-access`

ID: `53695b42-59f9-4e1d-a045-954d7a8e2940`

The application now uses the supplied `requests` and `audit_log` tables. IDs stay numeric in D1, statuses stay lowercase, request text stays in `reason`, and review identity/time use `reviewed_by` and `reviewed_at`. The API translates these to the existing dashboard presentation. Existing audit rows remain visible; an unknown prior status appears as Unknown when it was not recorded by the original table.

## Required additive upgrade

The existing two tables need additional columns for version checks, email source/subject, email deduplication, decision notes and the notification outbox. The project now points Wrangler to `schema-upgrades`, not the original `migrations` folder.

1. `schema-upgrades/0000_existing_tables.sql` matches the user-created tables and uses CREATE IF NOT EXISTS. Existing rows and tables are retained.
2. `schema-upgrades/0001_admin_features.sql` adds the required columns, notification outbox and audit triggers. It does not delete records or replace either table. Review this file before applying it to production. It assumes the exact base schema supplied in this session and no earlier project migrations have been applied.

In PowerShell from `C:\C&G Admin`, sign in if necessary:

```powershell
node ./node_modules/wrangler/bin/wrangler.js login
```

Apply the configured migrations:

```powershell
node ./node_modules/wrangler/bin/wrangler.js d1 migrations apply circuitgrain-access --remote
```

Wrangler tracks applied migration filenames. Do not paste the ALTER TABLE script repeatedly into the console or run the old migration folder against this database. If additional columns were added manually after sharing the schema, inspect the live schema before applying the upgrade. Take a database export through Cloudflare before changing production schema if records already exist.

## Unique email behavior

The supplied schema makes email unique, case-insensitively. The app keeps that rule: one request per email address. A repeated public form submission returns a conflict without replacing the original reason, decision or audit history. Email duplicates retain the existing record and do not send duplicate notifications. To restore access to a rejected/revoked address, use Reapprove on its original record.

## Validation

`npm test` checks workflow, adapters, authentication and email/public submission behavior. `python tests/existing_schema_check.py` builds the exact supplied schema in SQLite, seeds existing rows, applies the additive upgrade, and checks preservation, numeric IDs, lowercase states, unique emails, version guards, review metadata and atomic audit/outbox behavior.

The older Python checks under tests target the earlier proposed schema and are retained as legacy references. Use existing_schema_check.py for this database.

Local tests and config changes do not apply migrations, deploy the Worker or activate email routing.
