import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,exportJWK,SignJWT,jwtVerify} from 'jose';
import {handleGoogleAuth,authenticateAdmin} from '../worker/googleAuth.js';
const env={GOOGLE_CLIENT_ID:'test.apps.googleusercontent.com',GOOGLE_CLIENT_SECRET:'private-test-secret',GOOGLE_REDIRECT_URI:'https://admin.circuitgrain.shop/auth/google/callback',ADMIN_SESSION_SECRET:'test-session-secret-at-least-32-characters',ADMIN_EMAILS:'insanedk46@gmail.com'};
const loginRequest=()=>new Request('https://admin.circuitgrain.shop/auth/login');
const key=new TextEncoder().encode(env.ADMIN_SESSION_SECRET);
const cookieValue=(response,name)=>response.headers.getSetCookie().find(value=>value.startsWith(name+'='))?.split(';')[0];
test('Google redirect has state, nonce, PKCE and a secure short-lived cookie',async()=>{
 const response=await handleGoogleAuth(loginRequest(),env);assert.equal(response.status,303);
 const url=new URL(response.headers.get('Location'));assert.equal(url.origin,'https://accounts.google.com');assert.equal(url.searchParams.get('redirect_uri'),env.GOOGLE_REDIRECT_URI);assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.equal(url.searchParams.get('scope'),'openid email');assert.ok(url.searchParams.get('nonce'));assert.ok(url.searchParams.get('state'));
 const value=cookieValue(response,'__Host-cg_google');assert.ok(value);assert.match(response.headers.getSetCookie()[0],/HttpOnly; Secure; SameSite=Lax/);
 const state=(await jwtVerify(value.split('=')[1],key)).payload;assert.equal(state.state,url.searchParams.get('state'));assert.equal(state.nonce,url.searchParams.get('nonce'));assert.ok(state.verifier);
});
test('missing/mismatched state does not reach Google token exchange',async(t)=>{
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;throw new Error('Unexpected token exchange');});
 const response=await handleGoogleAuth(new Request(env.GOOGLE_REDIRECT_URI+'?code=fake&state=missing'),env);assert.match(response.headers.get('Location'),/auth_error=expired/);assert.equal(calls,0);
 const login=await handleGoogleAuth(loginRequest(),env);const cookie=cookieValue(login,'__Host-cg_google');
 const mismatch=await handleGoogleAuth(new Request(env.GOOGLE_REDIRECT_URI+'?code=fake&state=wrong',{headers:{Cookie:cookie}}),env);assert.match(mismatch.headers.get('Location'),/auth_error=failed/);assert.equal(calls,0);
});
test('logout requires same-origin POST and clears the admin cookie',async()=>{
 const url='https://admin.circuitgrain.shop/auth/logout';
 assert.equal((await handleGoogleAuth(new Request(url),env)).status,405);
 assert.equal((await handleGoogleAuth(new Request(url,{method:'POST',headers:{Origin:'https://evil.example'}}),env)).status,403);
 const response=await handleGoogleAuth(new Request(url,{method:'POST',headers:{Origin:'https://admin.circuitgrain.shop'}}),env);assert.equal(response.status,200);assert.match(response.headers.get('Set-Cookie'),/Max-Age=0/);
});
test('session checks enforce the current allowlist and reject state tokens as sessions',async()=>{
 for(const [email,allowed] of [['insanedk46@gmail.com',true],['other@example.com',false]]){
  const token=await new SignJWT({email,email_verified:true}).setSubject('google-user').setIssuer('https://admin.circuitgrain.shop').setAudience('cg-admin-session').setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('1h').sign(key);
  const req=new Request('https://admin.circuitgrain.shop/api/session',{headers:{Cookie:`__Host-cg_admin=${token}`}});
  if(allowed)assert.equal(await authenticateAdmin(req,env),email);else await assert.rejects(authenticateAdmin(req,env),/FORBIDDEN/);
 }
 const login=await handleGoogleAuth(loginRequest(),env);const token=cookieValue(login,'__Host-cg_google').split('=')[1];
 await assert.rejects(authenticateAdmin(new Request('https://admin.circuitgrain.shop/api/session',{headers:{Cookie:`__Host-cg_admin=${token}`}}),env),/AUTH/);
});
test('callback verifies Google tokens, permits only allowed email, and creates an admin session',async(t)=>{
 const {privateKey,publicKey}=await generateKeyPair('RS256');const jwk=await exportJWK(publicKey);jwk.kid='google-auth-test';let identity;let issuedNonce;let claims={};
 t.mock.method(globalThis,'fetch',async(input,options)=>{
  if(String(input).includes('oauth2.googleapis.com/token')){
   const params=new URLSearchParams(options.body);assert.equal(params.get('client_secret'),env.GOOGLE_CLIENT_SECRET);assert.ok(params.get('code_verifier'));
   const token=await new SignJWT({email:identity,email_verified:true,nonce:issuedNonce,...claims}).setProtectedHeader({alg:'RS256',kid:jwk.kid}).setSubject('google-user').setIssuer('https://accounts.google.com').setAudience(env.GOOGLE_CLIENT_ID).setIssuedAt().setExpirationTime('5m').sign(privateKey);return Response.json({id_token:token});
  }
  return Response.json({keys:[jwk]});
 });
 for(const [email,override,expected] of [['other@example.com',{},'/?auth_error=not_allowed'],['insanedk46@gmail.com',{email_verified:false},'/?auth_error=failed'],['insanedk46@gmail.com',{nonce:'wrong-nonce'},'/?auth_error=failed'],['insanedk46@gmail.com',{},'/']]){
  identity=email;claims=override;const login=await handleGoogleAuth(loginRequest(),env);const url=new URL(login.headers.get('Location'));issuedNonce=url.searchParams.get('nonce');
  const callback=new URL(env.GOOGLE_REDIRECT_URI);callback.search=new URLSearchParams({code:'one-use-google-code',state:url.searchParams.get('state')});
  const response=await handleGoogleAuth(new Request(callback,{headers:{Cookie:cookieValue(login,'__Host-cg_google')}}),env);
  if(expected!=='/'){assert.equal(response.headers.get('Location'),expected);assert.equal(cookieValue(response,'__Host-cg_admin'),undefined);}
  else{assert.equal(response.headers.get('Location'),'/');const cookie=cookieValue(response,'__Host-cg_admin');assert.ok(cookie);assert.equal(await authenticateAdmin(new Request('https://admin.circuitgrain.shop/api/session',{headers:{Cookie:cookie}}),env),email);}
 }
});
test('Google sign-in fails cleanly until secrets are configured',async()=>{
 const response=await handleGoogleAuth(loginRequest(),{});assert.equal(response.headers.get('Location'),'/?auth_error=not_configured');
});
