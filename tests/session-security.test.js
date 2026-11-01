import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getSession} from '../src/services/sessionService.js';
test('a stored local session cannot bypass server authentication',async(t)=>{
 t.mock.method(globalThis,'fetch',async()=>new Response(null,{status:401}));
 const original=globalThis.sessionStorage;globalThis.sessionStorage={getItem:()=> 'active'};
 try{assert.equal(await getSession(),false);}finally{if(original===undefined)delete globalThis.sessionStorage;else globalThis.sessionStorage=original;}
});
test('server-denied accounts cannot mount the dashboard',async(t)=>{
 t.mock.method(globalThis,'fetch',async()=>new Response(null,{status:403}));assert.equal(await getSession(),false);
});
test('only the permitted administrator session is accepted',async(t)=>{
 t.mock.method(globalThis,'fetch',async()=>Response.json({user:{email:'insanedk46@gmail.com'}}));assert.equal(await getSession(),true);
});

test('HTML fallback does not leak a JSON parsing error onto the sign-in form',async(t)=>{
 t.mock.method(globalThis,'fetch',async()=>new Response('<!doctype html><html></html>',{headers:{'Content-Type':'text/html'}}));assert.equal(await getSession(),false);
});
test('malformed session JSON does not authenticate or expose parsing errors',async(t)=>{
 t.mock.method(globalThis,'fetch',async()=>new Response('<!doctype html>',{headers:{'Content-Type':'application/json'}}));assert.equal(await getSession(),false);
});