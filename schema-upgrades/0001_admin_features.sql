-- Additive upgrade for the supplied requests/audit_log schema. Run once through Wrangler migrations.
ALTER TABLE requests ADD COLUMN version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE requests ADD COLUMN source TEXT NOT NULL DEFAULT 'form' CHECK(source IN ('form','email'));
ALTER TABLE requests ADD COLUMN email_subject TEXT NOT NULL DEFAULT '';
ALTER TABLE requests ADD COLUMN email_message_key TEXT;
ALTER TABLE requests ADD COLUMN submission_key TEXT;
ALTER TABLE requests ADD COLUMN decision_note TEXT NOT NULL DEFAULT '';
ALTER TABLE audit_log ADD COLUMN from_status TEXT;
ALTER TABLE audit_log ADD COLUMN to_status TEXT;
ALTER TABLE audit_log ADD COLUMN reason TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX requests_submission_key ON requests(submission_key) WHERE submission_key IS NOT NULL;
CREATE UNIQUE INDEX requests_email_key ON requests(email_message_key) WHERE email_message_key IS NOT NULL;
CREATE INDEX audit_log_request ON audit_log(request_id,id DESC);
CREATE TABLE notification_outbox (
 id TEXT PRIMARY KEY,
 request_id INTEGER NOT NULL REFERENCES requests(id),
 attempts INTEGER NOT NULL DEFAULT 0,
 sent_at TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX outbox_pending ON notification_outbox(sent_at,attempts);
CREATE TRIGGER audit_request_decision AFTER UPDATE OF status ON requests
WHEN OLD.status != NEW.status
BEGIN
 INSERT INTO audit_log(request_id,actor,action,created_at,from_status,to_status,reason)
 VALUES(NEW.id,COALESCE(NEW.reviewed_by,'unknown'),NEW.status,NEW.updated_at,OLD.status,NEW.status,NEW.decision_note);
END;
CREATE TRIGGER audit_log_no_update BEFORE UPDATE ON audit_log BEGIN SELECT RAISE(ABORT,'History is append-only'); END;
CREATE TRIGGER audit_log_no_delete BEFORE DELETE ON audit_log BEGIN SELECT RAISE(ABORT,'History is append-only'); END;
