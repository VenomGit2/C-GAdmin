import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
test('login screen is public, data and login callback remain protected',async()=>{
 const env = {ASSETS:{fetch:async()=>new Response('<html>Login</html>',{headers:{'Content-Type':'text/html'}})}};
 const login = await worker.fetch(new Request('https://admin.example.com/'),env);
 assert.equal(login.status,200);
 assert.match(await login.text(),/Login/);
 for(const path of ['/api/session','/api/requests','/auth/login']) {
  const response = await worker.fetch(new Request(`https://admin.example.com${path}`),env);
  assert.equal(response.status,503);
 }
});
