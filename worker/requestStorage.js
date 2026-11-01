export function displayStatus(status) {
 const aliases={approve:'approved',reject:'rejected',revoke:'revoked',reapprove:'approved'};
 const value=aliases[status] || status || 'unknown';
 return value.charAt(0).toUpperCase()+value.slice(1).toLowerCase();
}
export function isoDate(value) {
 return value && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? value.replace(' ','T')+'Z' : value;
}
export function dashboardRecord(row) {
 return {...row,id:String(row.id),name:row.email.split('@')[0],organization:'',purpose:row.reason,status:displayStatus(row.status),created_at:isoDate(row.created_at),updated_at:isoDate(row.updated_at)};
}
export function historyRecord(row) {
 return {...row,request_id:String(row.request_id),from_status:displayStatus(row.from_status),to_status:displayStatus(row.to_status || row.action),created_at:isoDate(row.created_at)};
}
export async function saveNewRequest(env,{email,reason,source='form',subject='',messageKey=null}) {
 const submissionKey=messageKey || crypto.randomUUID();
 const notificationId=`new-${submissionKey}`;
 const results=await env.DB.batch([
  env.DB.prepare("INSERT OR IGNORE INTO requests(email,reason,status,source,email_subject,email_message_key,submission_key) VALUES(?,?,'pending',?,?,?,?) RETURNING id").bind(email,reason,source,subject,messageKey,submissionKey),
  env.DB.prepare('INSERT OR IGNORE INTO notification_outbox(id,request_id) SELECT ?,id FROM requests WHERE submission_key=?').bind(notificationId,submissionKey)
 ]);
 const inserted=results[0].meta.changes===1;
 return {inserted,id:inserted?String(results[0].results[0].id):null,notificationId};
}
