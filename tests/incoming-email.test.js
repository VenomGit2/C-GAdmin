import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isAccessRequestSubject,hasTrustedAuthentication,handleIncomingEmail,plainText} from '../worker/incomingEmail.js';
test('only explicit access-request subjects match',()=>{
 for(const subject of ['Request access','Access request for Circuit and Grain','REQUEST FOR ACCESS','Requesting access please','Request to access the collection']) assert.equal(isAccessRequestSubject(subject),true,subject);
 for(const subject of ['Invoice','Password reset','Your access was approved','Newsletter','Request a refund','Access revoked','Question about products','Access requesting']) assert.equal(isAccessRequestSubject(subject),false,subject);
});
test('only Cloudflare authentication results can authorise mail',()=>{
 assert.equal(hasTrustedAuthentication(new Headers({'Authentication-Results':'mx.cloudflare.net; spf=pass; dmarc=pass'})),true);
 assert.equal(hasTrustedAuthentication(new Headers({'Authentication-Results':'evil.example; dmarc=pass'})),false);
 assert.equal(hasTrustedAuthentication(new Headers({'Authentication-Results':'mx.cloudflare.net; dmarc=fail, evil.example; dmarc=pass'})),false);
});
function fixture(subject='Request access',extra={}) {
 const headers=new Headers({'Authentication-Results':'mx.cloudflare.net; dmarc=pass',...extra});
 const raw=`From: Alex Morgan <alex@example.com>\r\nTo: dnyaneshwar@circuitgrain.shop\r\nSubject: ${subject}\r\nMessage-ID: <request-one@example.com>\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nPlease grant access to your private collection.`;
 return {to:'dnyaneshwar@circuitgrain.shop',headers,rawSize:raw.length,raw:new Blob([raw]).stream(),setReject(reason){this.rejected=reason;}};
}
function setup(){
 const batches=[];const env={INBOUND_REQUEST_ADDRESS:'dnyaneshwar@circuitgrain.shop',DB:{prepare(sql){return {bind(...values){return {sql,values,first:async()=>null};}}},batch:async values=>{batches.push(values);return [{meta:{changes:batches.length===1?1:0},results:[{id:1}]},{meta:{changes:1}}];}}};
 return {env,batches};
}
test('unrelated and automated emails do not create requests',async()=>{
 for(const message of [fixture('Invoice'),fixture('Access request',{'Auto-Submitted':'auto-generated'}),fixture('Access request',{'X-CG-Notification':'1'}),fixture('Access request',{'In-Reply-To':'<original@example.com>'})]) {
  const {env,batches}=setup();await handleIncomingEmail(message,env,{waitUntil(){}});assert.equal(batches.length,0);
 }
});
test('authenticated access email creates Pending record and notification atomically',async()=>{
 const {env,batches}=setup();const tasks=[];await handleIncomingEmail(fixture(),env,{waitUntil:promise=>tasks.push(promise)});await Promise.all(tasks);
 assert.equal(batches.length,1);assert.equal(batches[0].length,2);assert.match(batches[0][0].sql,/'pending'/);assert.equal(batches[0][0].values[0],'alex@example.com');assert.equal(batches[0][0].values[3],'Request access');
});
test('redelivery uses same identity and does not notify again',async()=>{
 const {env,batches}=setup();let notifications=0;const ctx={waitUntil(){notifications++;}};await handleIncomingEmail(fixture(),env,ctx);await handleIncomingEmail(fixture(),env,ctx);
 assert.equal(batches[0][0].values[5],batches[1][0].values[5]);assert.equal(notifications,1);
});
test('spoofed and oversized messages are rejected',async()=>{
 for(const msg of [fixture('Access request',{'Authentication-Results':'evil.example; dmarc=pass'}),Object.assign(fixture(),{rawSize:2*1024*1024})]){const {env,batches}=setup();await handleIncomingEmail(msg,env,{});assert.ok(msg.rejected);assert.equal(batches.length,0);}
});
test('HTML is converted to inert plain text',()=>assert.equal(plainText('<p>Request &amp; details</p><script>bad()</script>'),'Request & details'));
