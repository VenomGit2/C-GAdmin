import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SignJWT} from 'jose';
import worker from '../worker/index.js';
test('the Worker checks the allowlist on every authenticated API request',async()=>{
 const env={ADMIN_SESSION_SECRET:'test-session-secret-at-least-32-characters',ADMIN_EMAILS:'insanedk46@gmail.com'};
 const token=await new SignJWT({email:'other@example.com',email_verified:true}).setSubject('google-user').setProtectedHeader({alg:'HS256'}).setIssuer('https://admin.circuitgrain.shop').setAudience('cg-admin-session').setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(env.ADMIN_SESSION_SECRET));
 const response=await worker.fetch(new Request('https://admin.circuitgrain.shop/api/session',{headers:{Cookie:`__Host-cg_admin=${token}`}}),env);assert.equal(response.status,403);
});