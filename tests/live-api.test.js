import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadDashboard} from '../src/services/requestService.js';
import {submitPublicRequest} from '../src/services/publicRequestService.js';
test('dashboard reads only the server response, never browser records',async(t)=>{
 let url;t.mock.method(globalThis,'fetch',async input=>{url=input;return Response.json({requests:[],user:{email:'admin@example.com'}});});
 const response=await loadDashboard();assert.equal(url,'/api/requests');assert.deepEqual(response.requests,[]);
});
test('submissions require server acceptance and do not return a local success',async(t)=>{
 t.mock.method(globalThis,'fetch',async()=>Response.json({error:'Verification required'},{status:400}));
 await assert.rejects(submitPublicRequest({email:'person@example.com',reason:'Please grant access',token:''}),/Verification required/);
});
test('HTML fallback produces a friendly service error',async(t)=>{
 t.mock.method(globalThis,'fetch',async()=>new Response('<!doctype html>',{headers:{'Content-Type':'text/html'}}));
 await assert.rejects(loadDashboard(),/Unable to complete this request/);
});
