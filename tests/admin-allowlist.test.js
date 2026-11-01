import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import worker from '../worker/index.js';
test('server rejects a correctly signed Google/Access identity outside the configured admin allowlist',async(t)=>{
 const {privateKey,publicKey}=await generateKeyPair('RS256');const jwk=await exportJWK(publicKey);jwk.kid='allowlist-test';
 t.mock.method(globalThis,'fetch',async()=>Response.json({keys:[jwk]}));
 const issuer='https://allowlist-check.cloudflareaccess.com';
 const env={ACCESS_TEAM_DOMAIN:issuer,ACCESS_AUD:'test-admin-aud',ADMIN_EMAILS:'insanedk46@gmail.com'};
 for(const [email,status] of [['other@example.com',403],['insanedk46@gmail.com',200]]){
  const token=await new SignJWT({email}).setProtectedHeader({alg:'RS256',kid:jwk.kid}).setIssuer(issuer).setAudience('test-admin-aud').setSubject('test-user').setIssuedAt().setExpirationTime('5m').sign(privateKey);
  const response=await worker.fetch(new Request('https://admin.circuitgrain.shop/api/session',{headers:{'Cf-Access-Jwt-Assertion':token}}),env);
  assert.equal(response.status,status);
 }
});
