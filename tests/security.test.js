import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
test('missing session configuration fails closed for APIs',async()=>{
 for(const path of ['/api/session','/api/requests'])assert.equal((await worker.fetch(new Request(`https://admin.circuitgrain.shop${path}`),{})).status,503);
});
test('missing/forged cookies and old Access headers cannot reach D1',async()=>{
 const env={ADMIN_SESSION_SECRET:'test-secret-at-least-32-characters-long',ADMIN_EMAILS:'insanedk46@gmail.com',DB:{prepare(){throw new Error('D1 must not be reached');}}};
 for(const path of ['/api/session','/api/requests'])for(const headers of [{},{Cookie:'__Host-cg_admin=forged'},{'Cf-Access-Jwt-Assertion':'old-access-token'}])assert.equal((await worker.fetch(new Request(`https://admin.circuitgrain.shop${path}`,{headers}),env)).status,401);
});
