import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript');
function load(file,mocks={}){const record={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:record,exports:record.exports,require:n=>mocks[n]||require(n),URL,URLSearchParams,Headers,process:{env:{}}});return record.exports;}
const policy=load('lib/analyticsPolicy.ts',{'./privacy':{publicTrackingPath:p=>['/','/stillbounds'].includes(p)?p:null}});
test('analytics only permits public paths and strips private referrer details',()=>{
 for(const p of ['/admin','/client/booking/secret','/stillbounds/review/secret','/photography/shop/payment','/art/shop/products/thing?token=secret','/art/shop/products/%2Fprivate','//evil.test'])assert.equal(policy.analyticsPath(p),null,p);
 for(const p of ['/','/stillbounds','/art/shop/products/edition-12','/art/exhibitions/memory'])assert.equal(policy.analyticsPath(p),p);
 assert.equal(policy.referrerHost('https://example.test/private?token=secret#email'),'example.test');assert.equal(policy.referrerHost('javascript:secret'),'');
});
test('privacy preferences, crawlers and prefetch are excluded',()=>{for(const h of [{'dnt':'1'},{'sec-gpc':'1'},{'user-agent':'WhatsApp/2.0'},{purpose:'prefetch'},{'next-router-prefetch':'1'}])assert.ok(policy.excludedAnalytics(new Headers(h)));assert.equal(policy.excludedAnalytics(new Headers({'user-agent':'Mozilla/5.0 iPhone'})),false);});
test('page metadata always sets matching OG and Twitter cards with unique canonical content',()=>{
 const seo=load('lib/seo.ts',{'next':{}});
 const a=seo.createPageMetadata({title:'Artwork',description:'Paintings',path:'/art/works'}),b=seo.createPageMetadata({title:'Photography',description:'Portraits',path:'/photography'});
 assert.notEqual(a.openGraph.images[0].url,b.openGraph.images[0].url);assert.equal(a.twitter.images[0],a.openGraph.images[0].url);assert.equal(new URL(a.openGraph.images[0].url,'https://test').searchParams.get('path'),'/art/works');
 const p=seo.createPageMetadata({title:'Edition',description:'Art',path:'/art/shop/products/edition-1',image:'https://example.test/art.jpg'});assert.equal(p.twitter.images[0],'https://example.test/art.jpg');
});

test('all public routes declare their own sharing metadata; future routes must do the same',()=>{
 const {isPrivatePage}=load('lib/privatePaths.ts');
 function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(dir+'/'+e.name):e.name==='page.tsx'?[dir+'/'+e.name]:[]);}
 for(const page of walk('app')){
  const path=page.replace(/^app/,'').replace(/\/page.tsx$/,'')||'/';
  if(isPrivatePage(path))continue;
  const layout=page.replace(/page.tsx$/,'layout.tsx');
  const own=fs.readFileSync(page,'utf8')+(fs.existsSync(layout)?fs.readFileSync(layout,'utf8'):'')+(path==='/'?fs.readFileSync('app/layout.tsx','utf8'):'');
  assert.match(own,/createPageMetadata|generateMetadata|openGraph/,path+' requires page-specific sharing metadata');
 }
});
test('daily and monthly calculations handle year boundaries, zero days and money totals',()=>{
 const {analyticsPeriodRows}=load('lib/analyticsPeriods.ts');
 const now=new Date('2026-01-02T12:00:00Z');
 const traffic=[{day:'2025-12-31',views:4,visitors:2,downloads:1},{day:'2026-01-02',views:6,visitors:3,downloads:2}];
 const sales=[{day:'2025-12-31',purchases:1,revenue:'120000'},{day:'2026-01-02',purchases:2,revenue:'230000'}];
 const daily=analyticsPeriodRows(3,traffic,sales,'daily',now);assert.equal(daily.length,3);assert.equal(daily[1].period,'2026-01-01');assert.equal(daily[1].views,0);assert.equal(daily[1].revenue,0);
 const months=analyticsPeriodRows(3,traffic,sales,'monthly',now);assert.equal(months.length,2);assert.equal(months[0].period,'2025-12');assert.equal(months[0].revenue,120000);assert.equal(months[1].period,'2026-01');assert.equal(months[1].purchases,2);assert.equal(months.reduce((s,r)=>s+r.views,0),10);assert.equal(months.reduce((s,r)=>s+r.visitors,0),5);
 const today=analyticsPeriodRows(1,traffic,sales,'daily',now);assert.equal(today.length,1);assert.equal(today[0].views,6);
});

test('weekly calculations use Monday boundaries and keep daily totals across months',()=>{
 const {analyticsPeriodRows}=load('lib/analyticsPeriods.ts');
 const rows=analyticsPeriodRows(8,[{day:'2025-12-28',views:2},{day:'2025-12-29',views:3},{day:'2026-01-04',views:5}],[{day:'2026-01-04',purchases:1,revenue:'50000'}],'weekly',new Date('2026-01-04T12:00:00Z'));
 assert.equal(rows.length,2);assert.equal(rows[0].period,'2025-12-22');assert.equal(rows[0].views,2);assert.equal(rows[1].period,'2025-12-29');assert.equal(rows[1].views,8);assert.equal(rows[1].revenue,50000);
});
