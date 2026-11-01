ALTER TABLE requests ADD COLUMN access_expires_at TEXT;
ALTER TABLE requests ADD COLUMN current_grant TEXT;
ALTER TABLE notification_outbox ADD COLUMN kind TEXT NOT NULL DEFAULT 'admin';
ALTER TABLE notification_outbox ADD COLUMN access_link_id TEXT;
CREATE TABLE access_links (
 id TEXT PRIMARY KEY,
 request_id INTEGER NOT NULL REFERENCES requests(id),
 request_version INTEGER NOT NULL,
 expires_at TEXT NOT NULL,
 used_at TEXT,
 redemption_nonce TEXT UNIQUE
);
CREATE TABLE access_sessions (
 token_hash TEXT PRIMARY KEY,
 request_id INTEGER NOT NULL REFERENCES requests(id),
 request_version INTEGER NOT NULL,
 grant_id TEXT NOT NULL REFERENCES access_links(id),
 expires_at TEXT NOT NULL
);
CREATE INDEX access_sessions_request ON access_sessions(request_id);
CREATE INDEX access_links_request ON access_links(request_id);
