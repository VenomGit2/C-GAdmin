import { SignJWT, jwtVerify, createRemoteJWKSet } from 'jose';
const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const encoder = new TextEncoder();
const sessionName = '__Host-cg_admin';
const stateName = '__Host-cg_google';
const sessionSeconds = 8 * 3600;
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
const random = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), value => value.toString(16).padStart(2,'0')).join('');
const cookie = (name,value,age) => `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
const readCookie = (request,name) => (request.headers.get('Cookie') || '').split(';').map(value=>value.trim()).find(value=>value.startsWith(`${name}=`))?.slice(name.length+1);
const origin = env => new URL(env.GOOGLE_REDIRECT_URI || 'https://admin.circuitgrain.shop/auth/google/callback').origin;
function key(env) {
  if (!env.ADMIN_SESSION_SECRET || env.ADMIN_SESSION_SECRET.length<32 || !env.ADMIN_EMAILS) throw new Error('CONFIG');
  return encoder.encode(env.ADMIN_SESSION_SECRET);
}
function allowed(email,env) {
  return typeof email==='string' && (env.ADMIN_EMAILS || '').split(',').map(value=>value.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase());
}
function redirect(location,cookies=[]) {
  const result = new Headers({...headers,Location:location});
  for (const value of cookies) result.append('Set-Cookie',value);
  return new Response(null,{status:303,headers:result});
}
const clearState=()=>cookie(stateName,'',0);
function fail(code) { return redirect(`/?auth_error=${code}`,[clearState()]); }
async function sign(payload,audience,seconds,env) {
  return new SignJWT(payload).setProtectedHeader({alg:'HS256',typ:'JWT'}).setIssuer(origin(env)).setAudience(audience).setIssuedAt().setExpirationTime(`${seconds}s`).sign(key(env));
}
async function read(token,audience,env) {
  return (await jwtVerify(token,key(env),{issuer:origin(env),audience,algorithms:['HS256'],requiredClaims:['exp','iat']})).payload;
}
export async function authenticateAdmin(request,env) {
  key(env);
  if (new URL(request.url).origin!==origin(env)) throw new Error('AUTH');
  const token=readCookie(request,sessionName);
  if(!token)throw new Error('AUTH');
  let payload;
  try {payload=await read(token,'cg-admin-session',env);}catch{throw new Error('AUTH');}
  if(!payload.sub || payload.email_verified!==true || !allowed(payload.email,env))throw new Error('FORBIDDEN');
  return payload.email;
}
export async function verifyGoogleIdentity(token,nonce,env) {
  const {payload}=await jwtVerify(token,googleKeys,{issuer:['https://accounts.google.com','accounts.google.com'],audience:env.GOOGLE_CLIENT_ID,algorithms:['RS256'],requiredClaims:['exp','iat','sub','email','email_verified','nonce']});
  if(payload.nonce!==nonce || payload.email_verified!==true || (payload.azp && payload.azp!==env.GOOGLE_CLIENT_ID) || (Array.isArray(payload.aud) && payload.aud.length>1 && payload.azp!==env.GOOGLE_CLIENT_ID))throw new Error('AUTH');
  if(!allowed(payload.email,env))throw new Error('FORBIDDEN');
  return payload;
}
export async function handleGoogleAuth(request,env) {
  const url=new URL(request.url);
  if(url.origin!==origin(env))return Response.json({error:'Sign in on admin.circuitgrain.shop.'},{status:403,headers});
  if(url.pathname==='/auth/logout'){
    if(request.method!=='POST')return Response.json({error:'Method not allowed.'},{status:405,headers});
    if(request.headers.get('Origin')!==url.origin)return Response.json({error:'Invalid request origin.'},{status:403,headers});
    const response=Response.json({ok:true},{headers:{...headers,'Set-Cookie':cookie(sessionName,'',0)}}); response.headers.append('Set-Cookie',clearState()); return response;
  }
  if(request.method!=='GET')return Response.json({error:'Method not allowed.'},{status:405,headers});
  if(!['/auth/login','/auth/google/callback'].includes(url.pathname))return Response.json({error:'Not found.'},{status:404,headers});
  try {
    key(env);
    if(!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI || env.GOOGLE_REDIRECT_URI!==`${origin(env)}/auth/google/callback` || !env.GOOGLE_REDIRECT_URI.startsWith('https://'))return fail('not_configured');
    if(url.pathname==='/auth/login'){
      const state=random(),verifier=random(),nonce=random();
      const digest=await crypto.subtle.digest('SHA-256',encoder.encode(verifier));
      const challenge=btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
      const stateCookie=await sign({state,verifier,nonce},'cg-google-state',600,env);
      const destination=new URL('https://accounts.google.com/o/oauth2/v2/auth');
      destination.search=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:env.GOOGLE_REDIRECT_URI,response_type:'code',scope:'openid email',state,nonce,code_challenge:challenge,code_challenge_method:'S256',prompt:'select_account'}).toString();
      return redirect(destination.toString(),[cookie(stateName,stateCookie,600)]);
    }
    const stored=readCookie(request,stateName);
    if(!stored)return fail('expired');
    let state;
    try{state=await read(stored,'cg-google-state',env);}catch{return fail('expired');}
    if(!url.searchParams.get('state') || state.state!==url.searchParams.get('state'))return fail('failed');
    if(url.searchParams.has('error'))return fail('cancelled');
    const code=url.searchParams.get('code');
    if(!code || code.length>4096 || !state.verifier || !state.nonce)return fail('failed');
    const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:env.GOOGLE_REDIRECT_URI,grant_type:'authorization_code',code_verifier:state.verifier}),signal:AbortSignal.timeout(10000)});
    if(!response.ok)return fail('failed');
    const tokens=await response.json();
    if(typeof tokens.id_token!=='string')return fail('failed');
    const identity=await verifyGoogleIdentity(tokens.id_token,state.nonce,env);
    const session=await sign({sub:identity.sub,email:identity.email.toLowerCase(),email_verified:true},'cg-admin-session',sessionSeconds,env);
    return redirect('/',[clearState(),cookie(sessionName,session,sessionSeconds)]);
  }catch(error){return fail(error.message==='FORBIDDEN'?'not_allowed':error.message==='CONFIG'?'not_configured':'failed');}
}
