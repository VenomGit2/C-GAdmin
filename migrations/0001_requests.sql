CREATE TABLE requests (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 email TEXT NOT NULL,
 organization TEXT NOT NULL DEFAULT '',
 purpose TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending','Approved','Rejected','Revoked')),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 version INTEGER NOT NULL DEFAULT 0,
 decision_actor TEXT,
 decision_reason TEXT
);
CREATE TABLE request_history (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 request_id TEXT NOT NULL REFERENCES requests(id),
 from_status TEXT NOT NULL,
 to_status TEXT NOT NULL,
 actor TEXT NOT NULL,
 reason TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL
);
CREATE INDEX history_request ON request_history(request_id, id DESC);
CREATE TRIGGER record_decision AFTER UPDATE OF status ON requests
WHEN OLD.status != NEW.status
BEGIN
 INSERT INTO request_history(request_id,from_status,to_status,actor,reason,created_at)
 VALUES(NEW.id,OLD.status,NEW.status,NEW.decision_actor,COALESCE(NEW.decision_reason,''),NEW.updated_at);
END;
CREATE TRIGGER history_no_update BEFORE UPDATE ON request_history BEGIN SELECT RAISE(ABORT,'History is append-only'); END;
CREATE TRIGGER history_no_delete BEFORE DELETE ON request_history BEGIN SELECT RAISE(ABORT,'History is append-only'); END;
