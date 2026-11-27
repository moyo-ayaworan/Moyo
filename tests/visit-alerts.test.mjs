import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {visitContext} from '../lib/visitContext.ts';
function load(file,mocks,env={}){const compiled={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:compiled,exports:compiled.exports,require:n=>{if(!(n in mocks))throw Error(n);return mocks[n];},process:{env},Response,Request,URL,Date,Intl,console,Buffer});return compiled.exports;}
const privacy=load('lib/privacy.ts',{'./eniyanNavigation':load('lib/eniyanNavigation.ts',{})});
const analytics=load('lib/analyticsPolicy.ts',{'./privacy':privacy});
const response={NextResponse:{json:(body,options={})=>Response.json(body,options)}};
const body=load('lib/requestBody.ts',{'next/server':response});
const iphone='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
test('visit emails summarize location and device from request headers with no raw identifiers',()=>{
 const h=new Headers({'user-agent':iphone,'x-vercel-ip-city':'S%C3%A3o%20Paulo','x-vercel-ip-country-region':'SP','x-vercel-ip-country':'BR','x-forwarded-for':'203.0.113.1','x-vercel-ip-latitude':'-23.5','x-vercel-ip-longitude':'-46.6'});
 const result=visitContext(h,true);assert.deepEqual(result,{location:'São Paulo, SP, Brazil',device:'Mobile',browser:'Safari',os:'iOS / iPadOS'});
 assert.equal(visitContext(h,false).location,'Unavailable');assert(!JSON.stringify(result).includes('203.0.113.1'));assert(!JSON.stringify(result).includes('Mozilla'));assert(!JSON.stringify(result).includes('-23.5'));
});
test('browser families are ordered correctly and Android tablets are not classified as phones',()=>{
 for(const [ua,expected] of [['Mozilla/5.0 (Windows NT 10.0) Chrome/130 Safari/537.36 Edg/130','Microsoft Edge'],['Mozilla/5.0 (Android 14) Chrome/130 Safari/537.36 SamsungBrowser/27','Samsung Internet'],['Mozilla/5.0 Chrome/130 Safari/537.36 OPR/115','Opera'],['Mozilla/5.0 (X11; Linux x86_64) Firefox/130','Firefox']])assert.equal(visitContext(new Headers({'user-agent':ua}),false).browser,expected);
 assert.equal(visitContext(new Headers({'user-agent':'Mozilla/5.0 (Linux; Android 14; Tablet) Chrome/130 Safari/537.36'}),false).device,'Tablet');
 assert.equal(visitContext(new Headers(),false).device,'Unknown');
});
test('malformed and injection-like location headers fail closed',()=>{
 for(const city of ['%0ANew%20line','%3Cscript%3E','%E0%A4%A','x'.repeat(300),'%250Asecret'])assert.equal(visitContext(new Headers({'x-vercel-ip-city':city}),true).location,'Unavailable');
});
function fixture(){const sent=[];let limited=0;const route=load('app/api/notify-session/route.ts',{'next/server':response,'@/lib/requestBody':body,'@/lib/privacy':privacy,'@/lib/analyticsPolicy':analytics,'@/lib/visitContext':{visitContext:h=>visitContext(h,true)},'@/lib/rateLimit':{rateLimit:async()=>{limited++;return null;}},nodemailer:{default:{createTransport:()=>({sendMail:async message=>{sent.push(message);return {accepted:['studio@example.test'],rejected:[]};}})}}},{VERCEL_ENV:'production',EMAIL_USER:'studio@example.test',EMAIL_PASS:'synthetic',CONTACT_EMAIL:'studio@example.test'});return {post:(data,headers={})=>route.POST(new Request('https://site.example/api/notify-session',{method:'POST',headers:{origin:'https://site.example','user-agent':iphone,...headers},body:JSON.stringify(data)})),sent,limits:()=>limited};}
test('session email ignores forged posted location/device/time and uses coarse server-derived context',async()=>{
 const f=fixture();const r=await f.post({path:'/photography',userAgent:'FORGED-PRIVATE-UA',location:'FORGED-LOCATION',timestamp:0},{'x-vercel-ip-city':'Lagos','x-vercel-ip-country-region':'LA','x-vercel-ip-country':'NG'});
 assert.equal(r.status,200);assert.equal(f.sent.length,1);const text=f.sent[0].text;assert.match(text,/Approximate location: Lagos, LA, Nigeria/);assert.match(text,/Device category: Mobile/);assert.match(text,/Browser: Safari/);assert.match(text,/Operating system: iOS/);assert.match(text,/Africa\/Lagos/);
 assert(!text.includes('FORGED'));assert(!text.includes('1970'));assert(!text.includes('Mozilla'));assert.equal(r.headers.get('cache-control'),'private, no-store');
});
test('session alerts honor privacy signals, exclude private/product paths, and reject cross-origin spam',async()=>{
 const f=fixture();
 for(const path of ['/admin','/collector/private-token','/client/booking/token','/photography?token=secret','/stillbounds','/stillbounds/privacy','/mofolio'])assert.equal((await f.post({path})).status,204,path);
 for(const headers of [{dnt:'1'},{'sec-gpc':'1'},{'user-agent':'Googlebot'},{purpose:'prefetch'}])assert.equal((await f.post({path:'/photography'},headers)).status,204);
 assert.equal((await f.post({path:'/photography'},{origin:'https://other.example'})).status,403);assert.equal(f.sent.length,0);assert.equal(f.limits(),0);
});
