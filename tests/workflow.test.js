import { test } from 'node:test';
import assert from 'node:assert/strict';
import {canTransition, actionLabel, statuses} from '../src/utils/workflow.js';
test('only intended lifecycle transitions are accepted',()=>{
 const allowed = new Set(['Pending:Approved','Pending:Rejected','Approved:Revoked','Rejected:Approved','Revoked:Approved']);
 for(const from of [...statuses,'Unknown']) for(const to of [...statuses,'Unknown']) assert.equal(canTransition(from,to),allowed.has(`${from}:${to}`));
});
test('returning access uses the reapprove label',()=>{
 assert.equal(actionLabel('Pending','Approved'),'Approve');
 assert.equal(actionLabel('Rejected','Approved'),'Reapprove');
 assert.equal(actionLabel('Revoked','Approved'),'Reapprove');
});
