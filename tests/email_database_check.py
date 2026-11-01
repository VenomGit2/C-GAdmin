import sqlite3
from pathlib import Path
db=sqlite3.connect(':memory:')
for migration in sorted((Path(__file__).parent.parent/'migrations').glob('*.sql')):
    db.executescript(migration.read_text())
sql="INSERT OR IGNORE INTO requests(id,name,email,purpose,status,source,email_subject,email_message_key) VALUES(?,?,?,?,'Pending','email',?,?)"
values=('CG-E-1','Alex','alex@example.com','Please grant access','Access request','stable-message')
for _ in range(2):
    with db:
        db.execute(sql,values)
        db.execute("INSERT OR IGNORE INTO notification_outbox(id,request_id) VALUES('CG-E-1','CG-E-1')")
assert db.execute('SELECT count(*) FROM requests').fetchone()[0]==1
assert db.execute('SELECT count(*) FROM notification_outbox').fetchone()[0]==1
assert db.execute('SELECT source,email_subject,status FROM requests').fetchone()==('email','Access request','Pending')
assert db.execute(sql,('CG-E-other',*values[1:])).rowcount==0
print('PASS: email migration, Pending source metadata, redelivery deduplication, unique message identity')
