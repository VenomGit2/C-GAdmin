import sqlite3
from pathlib import Path

db = sqlite3.connect(':memory:')
db.executescript((Path(__file__).parent.parent / 'migrations/0001_requests.sql').read_text())
db.execute("INSERT INTO requests(id,name,email) VALUES('CG-1','Test','test@example.com')")
sql = "UPDATE requests SET status=?, version=version+1, updated_at='2026-11-01T00:00:00Z', decision_actor='admin@example.com', decision_reason='Reviewed' WHERE id='CG-1' AND version=?"
assert db.execute(sql, ('Approved',0)).rowcount == 1
assert db.execute(sql, ('Revoked',0)).rowcount == 0
assert db.execute('SELECT from_status,to_status,actor FROM request_history').fetchall() == [('Pending','Approved','admin@example.com')]
assert db.execute(sql, ('Revoked',1)).rowcount == 1
assert db.execute('SELECT count(*) FROM request_history').fetchone()[0] == 2
for statement in ['DELETE FROM request_history','UPDATE request_history SET actor=\'other\'']:
    try:
        db.execute(statement)
        raise AssertionError('Audit mutation should fail')
    except sqlite3.IntegrityError:
        pass
print('PASS: migration, atomic audit, stale version protection, append-only history')
