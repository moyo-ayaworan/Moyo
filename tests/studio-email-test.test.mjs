import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(file,mocks={},env={}){
 const module={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,
 {module,exports:module.exports,require:key=>{if(key in mocks)return mocks[key];throw Error('Unexpected dependency '+key);},process:{env},Date});return module.exports;
}
const {applyStudioMailEnvironment}=load('lib/studioMail.ts');
function harness({denied,limited,configured=true,failVerify=false}={}){
 const calls=[];let originRequired;
 const response=(body,init={})=>new Response(JSON.stringify(body),{status:init.status||200,headers:init.headers});
 const route=load('app/api/admin/email-test/route.ts',{
  'next/server':{NextResponse:{json:response}},
  '@/lib/auth':{requireAdmin:(_request,requireOrigin)=>{originRequired=requireOrigin;return denied?response({error:'Denied'},{status:denied}):null;}},
  '@/lib/rateLimit':{rateLimit:async()=>limited?response({error:'Limited'},{status:429}):null},
  '@/lib/studioMail':{applyStudioMailEnvironment},
  nodemailer:{createTransport:config=>{calls.push({config});return {verify:async()=>{if(failVerify)throw Error('private credential detail');return true;},sendMail:async mail=>{calls.push({mail});return {accepted:['moyoayaworan@gmail.com'],rejected:[],messageId:'test-id'};},close:()=>{}};}},
 },configured?{OYO_GMAIL_APP_PASSWORD:'abcdefghijklmnop'}:{});
 return {route,calls,originRequired:()=>originRequired};
}
test('studio email test requires admin and same-origin checks before using mail',async()=>{
 for(const denied of [401,403]){const h=harness({denied});const result=await h.route.POST(new Request('https://studio.example/api/admin/email-test',{method:'POST'}));assert.equal(result.status,denied);assert.equal(h.originRequired(),true);assert.equal(h.calls.length,0);}
});
test('status never sends email; missing configuration and rate limits prevent delivery',async()=>{
 const h=harness();const status=await h.route.GET(new Request('https://studio.example/api/admin/email-test'));assert.equal((await status.json()).newSenderConfigured,true);assert.equal(h.calls.length,0);
 for(const options of [{configured:false},{limited:true}]){const h=harness(options);const result=await h.route.POST(new Request('https://studio.example/api/admin/email-test',{method:'POST'}));assert.equal(result.status,options.limited?429:409);assert.equal(h.calls.length,0);}
});
test('authenticated test uses only the fixed new Gmail sender, recipient and reply address',async()=>{
 const h=harness();const result=await h.route.POST(new Request('https://studio.example/api/admin/email-test',{method:'POST',body:JSON.stringify({to:'someone-else@example.test'})}));assert.equal(result.status,200);
 const sent=h.calls.find(call=>call.mail).mail;assert.equal(sent.from.address,'moyoayaworan@gmail.com');assert.equal(sent.to,sent.from.address);assert.equal(sent.replyTo,sent.to);assert.match(sent.subject,/setup test/);
 const body=await result.json();assert.equal(body.sent,true);assert(!JSON.stringify(body).includes('abcdefghijklmnop'));assert.match(result.headers.get('cache-control'),/no-store/);
});
test('SMTP failure sends nothing and does not expose provider or credential details',async()=>{
 const h=harness({failVerify:true});const result=await h.route.POST(new Request('https://studio.example/api/admin/email-test',{method:'POST'}));assert.equal(result.status,503);assert.equal(h.calls.filter(call=>call.mail).length,0);assert(!JSON.stringify(await result.json()).includes('private credential detail'));
});
