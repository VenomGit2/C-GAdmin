CREATE TABLE notification_outbox (
 id TEXT PRIMARY KEY,
 request_id TEXT NOT NULL REFERENCES requests(id),
 attempts INTEGER NOT NULL DEFAULT 0,
 sent_at TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX outbox_pending ON notification_outbox(sent_at, attempts);
