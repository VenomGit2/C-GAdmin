import sqlite3,re
from pathlib import Path
root=Path(__file__).parent.parent
db=sqlite3.connect(':memory:')
for path in sorted((root/'schema-upgrades').glob('*.sql')):
    db.executescript(path.read_text())
db.execute("INSERT INTO requests(email,reason) VALUES('visitor@example.com','Please grant access')")
db.commit()
def query(file,prefix):
    source=Path(file).read_text(encoding='utf-8')
    for match in re.finditer(r'prepare\(([\x27\x22])(.*?)\1\)',source,re.S):
        if match[2].startswith(prefix): return match[2]
    raise AssertionError('SQL not found: '+prefix)
approval=root/'worker/approvalAccess.js'
gate=Path('C:/GitHub/eCommerceClient/eCommerce.Client/worker/access-gate.mjs')
update=query(approval,'UPDATE requests SET status=')
link=query(approval,'INSERT INTO access_links')
outbox=query(approval,'INSERT INTO notification_outbox')
redeem=query(gate,'UPDATE access_links SET used_at=')
session=query(gate,'INSERT INTO access_sessions')
now='2026-11-01T00:00:00.000Z'; expiry='2099-01-01T00:00:00.000Z'
def issue(grant,version):
    with db:
        changed=db.execute(update,('approved',now,now,'admin@example.com','Reviewed',expiry,grant,1,version,'pending' if version==0 else 'revoked')).rowcount
        db.execute(link,(grant,expiry,1,grant))
        db.execute(outbox,('access-'+grant,grant,1,grant))
    return changed
assert issue('grant-1',0)==1
assert issue('grant-stale',0)==0
assert db.execute('SELECT count(*) FROM access_links').fetchone()[0]==1
with db:
    assert db.execute(redeem,(now,'session-hash-1','grant-1',now,now)).rowcount==1
    db.execute(session,('session-hash-1',expiry,'grant-1','session-hash-1'))
with db:
    assert db.execute(redeem,(now,'session-hash-replay','grant-1',now,now)).rowcount==0
    db.execute(session,('session-hash-replay',expiry,'grant-1','session-hash-replay'))
assert db.execute('SELECT count(*) FROM access_sessions').fetchone()[0]==1
db.execute(update,('revoked',now,now,'admin@example.com','Revoked',None,None,1,1,'approved'))
db.commit()
row=db.execute('SELECT r.status,r.version,s.request_version,r.current_grant FROM access_sessions s JOIN requests r ON r.id=s.request_id').fetchone()
assert row==('revoked',2,1,None)
assert issue('grant-2',2)==1
assert db.execute('SELECT version FROM requests').fetchone()[0]==3
assert db.execute('SELECT request_version FROM access_sessions').fetchone()[0]==1
assert db.execute('SELECT count(*) FROM audit_log').fetchone()[0]==3
print('PASS: timed schema, atomic approval/outbox, stale approval, one-time redemption, replay rejection, revoke and reapprove invalidate old sessions')
