import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
test('missing Access configuration fails closed for protected endpoints',async()=>{
 for(const path of ['/auth/login','/api/session','/api/requests']) {
  const response = await worker.fetch(new Request(`https://admin.example.com${path}`),{});
  assert.equal(response.status,503);
 }
});
test('missing or forged tokens cannot reach sessions or D1',async()=>{
 const env = {ACCESS_TEAM_DOMAIN:'https://test.cloudflareaccess.com',ACCESS_AUD:'test-aud',ADMIN_EMAILS:'admin@example.com',ASSETS:{fetch(){throw new Error('Assets must not be reached');}}};
 for(const path of ['/auth/login','/api/session','/api/requests']) for(const token of ['', 'forged-token']) {
  const response = await worker.fetch(new Request(`https://admin.example.com${path}`,{headers:token?{'Cf-Access-Jwt-Assertion':token}:{}}),env);
  assert.equal(response.status,401);
 }
});
