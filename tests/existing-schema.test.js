import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dashboardRecord,historyRecord,saveNewRequest} from '../worker/requestStorage.js';
test('existing numeric IDs, lowercase statuses and reason map to the dashboard contract',()=>{
 const row=dashboardRecord({id:42,email:'person@example.com',reason:'Request details',status:'approved',created_at:'2026-11-01 10:30:00',version:0});
 assert.equal(row.id,'42');assert.equal(row.status,'Approved');assert.equal(row.purpose,'Request details');assert.equal(row.created_at,'2026-11-01T10:30:00Z');
 assert.equal(historyRecord({request_id:42,action:'approve',from_status:null}).to_status,'Approved');
});
test('duplicate emails return a conflict result without inventing a new request ID',async()=>{
 const env={DB:{prepare:()=>({bind:()=>({})}),batch:async()=>[{meta:{changes:0},results:[]},{meta:{changes:0}}]}};
 const saved=await saveNewRequest(env,{email:'person@example.com',reason:'Request details'});
 assert.equal(saved.inserted,false);assert.equal(saved.id,null);
});
