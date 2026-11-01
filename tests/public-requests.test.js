import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handlePublicRequest,validateSubmission,deliverNotification} from '../worker/publicRequests.js';
const url='https://admin.example.com/public-api/requests';
const fields={email:' person@example.com ',reason:'Please let me access the private collection.',token:'test-token',website:''};
const request=(body=fields,origin='https://admin.example.com')=>new Request(url,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
function env(){return {TURNSTILE_SECRET_KEY:'test-secret-key',TURNSTILE_SITE_KEY:'test-site-key',RESEND_API_KEY:'test',EMAIL_FROM:'test@example.com',DB:{prepare(sql){return {bind(...values){return {sql,values,first:async()=>null};}}},batch:async()=>{}}};}
test('submission validates email and reason',()=>{
 assert.equal(validateSubmission({...fields,email:'bad'}),null);
 assert.equal(validateSubmission({...fields,reason:'short'}),null);
 assert.equal(validateSubmission({...fields,reason:'a'.repeat(2001)}),null);
 assert.equal(validateSubmission(fields).email,'person@example.com');
});
test('cross-origin and honeypot requests cannot be inserted',async()=>{
 assert.equal((await handlePublicRequest(request(fields,'https://evil.example'),env(),{})).status,403);
 assert.equal((await handlePublicRequest(request({...fields,website:'spam'}),env(),{})).status,400);
});
test('Turnstile failures reject submissions before database insertion',async(t)=>{
 t.mock.method(globalThis,'fetch',async()=>Response.json({success:false}));
 const e=env();let inserted=false;e.DB.batch=async()=>{inserted=true;};
 assert.equal((await handlePublicRequest(request(),e,{})).status,400);assert.equal(inserted,false);
});
test('Turnstile hostname and action must match',async(t)=>{
 t.mock.method(globalThis,'fetch',async()=>Response.json({success:true,hostname:'evil.example',action:'request-access'}));
 assert.equal((await handlePublicRequest(request(),env(),{})).status,400);
});
test('verified submission atomically inserts Pending record and outbox',async(t)=>{
 t.mock.method(globalThis,'fetch',async()=>Response.json({success:true,hostname:'admin.example.com',action:'request-access'}));
 const e=env();let batch;e.DB.batch=async statements=>{batch=statements;return [{meta:{changes:1},results:[{id:1}]},{meta:{changes:1}}];};const tasks=[];
 const response=await handlePublicRequest(request(),e,{waitUntil:promise=>tasks.push(promise)});
 assert.equal(response.status,201);assert.equal((await response.json()).status,'Pending');
 assert.equal(batch.length,2);assert.match(batch[0].sql,/pending/);assert.equal(batch[0].values[0],'person@example.com');assert.match(batch[1].sql,/notification_outbox/);await Promise.all(tasks);
});
test('notification always targets administrator with a stable idempotency key',async(t)=>{
 let payload,headers; t.mock.method(globalThis,'fetch',async(u,options)=>{payload=JSON.parse(options.body);headers=options.headers;return Response.json({id:'mail-id'});});
 const writes=[];const e=env();e.DB.prepare=sql=>({bind:(...values)=>({first:async()=>({id:'test-id',attempts:0,email:'person@example.com',purpose:'Access please',request_id:'CG-1'}),run:async()=>writes.push({sql,values})})});
 await deliverNotification(e,'test-id');assert.deepEqual(payload.to,['dnyaneshwar@circuitgrain.shop']);assert.equal(headers['Idempotency-Key'],'request-test-id');assert.match(writes[1].sql,/sent_at/);
});

test('missing configuration is identified by name without logging secret values',async(t)=>{
 const logs=[];t.mock.method(console,'error',value=>logs.push(JSON.parse(value)));
 const e=env();delete e.TURNSTILE_SECRET_KEY;
 assert.equal((await handlePublicRequest(request(),e,{})).status,503);
 assert.deepEqual(logs,[{event:'request_configuration_missing',missing:['TURNSTILE_SECRET_KEY']}]);
});
test('missing mail settings do not discard a verified request or its durable notification',async(t)=>{
 t.mock.method(globalThis,'fetch',async()=>Response.json({success:true,hostname:'admin.example.com',action:'request-access'}));
 const e=env();delete e.RESEND_API_KEY;delete e.EMAIL_FROM;let statements;const tasks=[];
 e.DB.batch=async values=>{statements=values;return [{meta:{changes:1},results:[{id:2}]},{meta:{changes:1}}];};
 const response=await handlePublicRequest(request(),e,{waitUntil:promise=>tasks.push(promise)});
 assert.equal(response.status,201);assert.equal(statements.length,2);assert.match(statements[1].sql,/notification_outbox/);await Promise.all(tasks);
});
test('secret is sent trimmed and form-encoded without leaking it in diagnostics',async(t)=>{
 const logs=[];t.mock.method(console,'error',value=>logs.push(value));let submitted;
 t.mock.method(globalThis,'fetch',async(url,options)=>{submitted=options;return Response.json({'success':false,'error-codes':['invalid-input-secret']},{status:400});});
 const e=env();e.TURNSTILE_SECRET_KEY=' private-secret-value \n';
 const response=await handlePublicRequest(request(),e,{});
 assert.equal(response.status,503);assert.equal((await response.json()).code,'TURNSTILE_SECRET_INVALID');assert.equal(submitted.headers['Content-Type'],'application/x-www-form-urlencoded');assert.equal(new URLSearchParams(submitted.body).get('secret'),'private-secret-value');assert.ok(!JSON.stringify(logs).includes('private-secret-value'));
});
test('a copied site key cannot be mistaken for its secret key',async(t)=>{
 t.mock.method(console,'error',()=>{});let contacted=false;t.mock.method(globalThis,'fetch',async()=>{contacted=true;return Response.json({});});
 const e=env();e.TURNSTILE_SECRET_KEY=e.TURNSTILE_SITE_KEY;
 const response=await handlePublicRequest(request(),e,{});assert.equal(response.status,503);assert.equal((await response.json()).code,'TURNSTILE_SECRET_IS_SITE_KEY');assert.equal(contacted,false);
});
test('non-JSON upstream errors produce safe diagnostic status instead of a parsing exception',async(t)=>{
 t.mock.method(console,'error',()=>{});t.mock.method(globalThis,'fetch',async()=>new Response('<html>Unavailable</html>',{status:502}));
 const response=await handlePublicRequest(request(),env(),{});const body=await response.json();assert.equal(response.status,503);assert.equal(body.verificationStatus,502);assert.equal(body.code,'TURNSTILE_UPSTREAM_ERROR');
});