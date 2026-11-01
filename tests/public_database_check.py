import sqlite3
from pathlib import Path

db = sqlite3.connect(':memory:')
root = Path(__file__).parent.parent
for migration in sorted((root / 'migrations').glob('*.sql')):
    db.executescript(migration.read_text())
with db:
    db.execute("INSERT INTO requests(id,name,email,purpose) VALUES('CG-public','person','person@example.com','Please grant access')")
    db.execute("INSERT INTO notification_outbox(id,request_id) VALUES('CG-public','CG-public')")
assert db.execute("SELECT status FROM requests WHERE id='CG-public'").fetchone()[0] == 'Pending'
assert db.execute('SELECT attempts,sent_at FROM notification_outbox').fetchone() == (0, None)
try:
    with db:
        db.execute("INSERT INTO requests(id,name,email) VALUES('CG-rollback','other','other@example.com')")
        db.execute("INSERT INTO notification_outbox(id,request_id) VALUES('CG-public','CG-rollback')")
except sqlite3.IntegrityError:
    pass
assert db.execute("SELECT count(*) FROM requests WHERE id='CG-rollback'").fetchone()[0] == 0
print('PASS: all migrations, Pending submissions, durable outbox, transaction rollback')
