import sqlite3
from pathlib import Path

db=sqlite3.connect(':memory:')
folder=Path(__file__).parent.parent/'schema-upgrades'
db.executescript((folder/'0000_existing_tables.sql').read_text())
db.execute("INSERT INTO requests(email,reason,status) VALUES('existing@example.com','Original request','approved')")
db.execute("INSERT INTO audit_log(request_id,actor,action) VALUES(1,'admin@example.com','approved')")
db.commit()
db.executescript((folder/'0001_admin_features.sql').read_text())
assert db.execute('SELECT id,email,reason,status FROM requests').fetchone()==(1,'existing@example.com','Original request','approved')
assert db.execute('SELECT count(*) FROM audit_log').fetchone()[0]==1
insert="INSERT OR IGNORE INTO requests(email,reason,status,source,email_subject,email_message_key,submission_key) VALUES(?,?,'pending',?,?,?,?) RETURNING id"
outbox='INSERT OR IGNORE INTO notification_outbox(id,request_id) SELECT ?,id FROM requests WHERE submission_key=?'
with db:
    request_id=db.execute(insert,('new@example.com','New request','email','Access request','mail-key','submit-key')).fetchone()[0]
    db.execute(outbox,('notification-key','submit-key'))
assert isinstance(request_id,int)
with db:
    assert db.execute(insert,('NEW@example.com','Duplicate','form','',None,'other-key')).fetchone() is None
    db.execute(outbox,('other-notification','other-key'))
assert db.execute('SELECT count(*) FROM notification_outbox').fetchone()[0]==1
update="UPDATE requests SET status=?,version=version+1,reviewed_at='2026-11-01T12:00:00Z',updated_at='2026-11-01T12:00:00Z',reviewed_by='admin@example.com',decision_note='Reviewed' WHERE id=? AND version=?"
assert db.execute(update,('approved',request_id,0)).rowcount==1
assert db.execute(update,('revoked',request_id,0)).rowcount==0
assert db.execute('SELECT from_status,to_status,actor,reason FROM audit_log WHERE request_id=?',(request_id,)).fetchone()==('pending','approved','admin@example.com','Reviewed')
assert db.execute('SELECT reason FROM requests WHERE id=?',(request_id,)).fetchone()[0]=='New request'
try:
    db.execute('DELETE FROM audit_log')
    raise AssertionError('Audit records must be append-only')
except sqlite3.IntegrityError:
    pass
print('PASS: existing records preserved, numeric IDs, lowercase states, unique emails, atomic outbox, review fields, stale decisions, audit history')
