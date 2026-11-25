import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';
const dependency = createRequire(import.meta.url);
const next = { NextResponse: class extends Response {
  static json(value, options) { return new this(JSON.stringify(value), options); }
} };
function load(file, mocks = {}, extra = {}) {
  if (file === 'lib/auth.ts') mocks = {'./adminSessions':{adminSessionActive:async()=>true},...mocks};
  if (file !== 'lib/galleryPreview.ts') mocks = { '@/lib/galleryPreview': load('lib/galleryPreview.ts'), ...mocks };
  const compiledModule = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    module: compiledModule, exports: compiledModule.exports, Buffer, Request, Response, URL, AbortSignal, console,
    process: { env: {} }, require: name => name in mocks ? mocks[name] : name === 'next/server' ? next : name === './eniyanNavigation' ? load('lib/eniyanNavigation.ts') : dependency(name), ...extra,
  });
  return compiledModule.exports;
}
const privacy = load('lib/privacy.ts');
const body = load('lib/requestBody.ts');
test('tracking never accepts private, unknown or query-bearing paths', () => {
  for (const path of ['/collector/secret', '/client/booking/secret', '/admin', '/stillbounds/review/id', '/photography?token=secret', '/photography/shop/payment', null, {}, 'https://evil.test/']) assert.equal(privacy.publicTrackingPath(path), null);
  assert.equal(privacy.publicTrackingPath('/photography/shop'), '/photography/shop');
});
test('private collector/review links and provider keys are blocked from AI chat', () => {
  for (const text of ['https://moyo.test/collector/0123456789abcdef', '/stillbounds/review/123#access=secret', '%2Fclient%2Fbooking%2Fsecret', 'sk_live_exampleprivatekey', 'whsec_exampleprivatekey', 'password: private', '?proof=private', '4242 4242 4242 4242']) assert.equal(privacy.containsPrivateDetails(text), true, text);
  assert.equal(privacy.containsPrivateDetails('Can I book a portrait session?'), false);
});
test('JSON streaming limit cancels chunked bodies before parsing or accumulating them', async () => {
  let cancelled = false;
  const request = new Request('https://example.test', { method: 'POST', duplex: 'half', body: new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(9)); controller.enqueue(new Uint8Array(9)); },
    cancel() { cancelled = true; },
  }) });
  const result = await body.readJsonRequest(request, 10);
  assert.equal(result.response.status, 413);
  assert.equal(cancelled, true);
  for (const text of ['null', '[]', '{invalid']) {
    assert.equal((await body.readJsonRequest(new Request('https://example.test', {method:'POST',body:text}), 100)).response.status, 400);
  }
  assert.equal((await body.readJsonRequest(new Request('https://example.test', {method:'POST',body:'{"ok":true}'}), 100)).body.ok, true);
});
test('gallery review and approval share the access-code attempt budget before any lookup', async () => {
  for (const path of ['review', 'approve-selection']) {
    const route = load(`app/api/galleries/${path}/route.ts`, {
      '@/lib/requestBody': body,
      '@/lib/rateLimit': { rateLimit: async (_req, action) => { assert.equal(action, 'gallery-access'); return new Response(null, {status:429}); } },
      '@/lib/db': { query() { assert.fail('rate-limited attempts must not query'); } },
    });
    assert.equal((await route.POST(new Request('https://example.test', {method:'POST',body:'{}'}))).status, 429);
  }
});
test('gallery deletion retains all financial documents and locks parent before checking', async () => {
  for (const hasDocuments of [true, false]) {
    const statements = [];
    const route = load('app/api/galleries/route.ts', {
      '@/lib/imagePosition': {}, '@/lib/galleryPresentation': {}, '@/lib/mediaUrl': {}, '@/lib/privateMedia': {},
      slugify: {}, '@/lib/auth': {requireAdmin: () => null},
      '@/lib/db': { transaction: async work => work({query: async sql => {
        statements.push(sql);
        return {rows: sql.startsWith('SELECT id FROM galleries') || hasDocuments ? [{id:1}] : []};
      }}) },
    });
    const result = await route.DELETE(new Request('https://example.test/api/galleries?id=1'));
    assert.equal(result.status, hasDocuments ? 409 : 200);
    assert.match(statements[0], /FOR UPDATE/);
    assert.equal(statements.some(sql => sql.startsWith('DELETE')), !hasDocuments);
  }
});
test('private session notifications return without emailing, even when submitted directly', async () => {
  const route = load('app/api/notify-session/route.ts', {
    '@/lib/requestBody': body, '@/lib/privacy': privacy,
    '@/lib/rateLimit': {rateLimit: async () => null},
    nodemailer: {createTransport() { assert.fail('must not send private path'); }},
  });
  const result = await route.POST(new Request('https://example.test', {method:'POST',body:JSON.stringify({path:'/collector/private-token',userAgent:'test',timestamp:Date.now()})}));
  assert.equal(result.status, 204);
});
test('an in-flight paid receipt cannot acknowledge a newly queued refund/review alert', async () => {
  let status = 'paid', sent = false;
  const messages = [];
  const order = () => ({reference:'audit-reference',email:'buyer@example.test',amount_kobo:2000000,title:'MELATONE',kind:'digital',shop_section:'photography',status});
  const route = load('lib/payments/notifications.ts', {
    '../productSections': {productShopPath: () => '/photography/shop'},
    '../paystack': {paymentOrigin: () => 'https://example.test'},
    '../purchaseAccess': {purchaseSigningKey: () => 'test-signing-key'},
    './policy': {isPaymentEmail: () => true, accessProof: () => 'proof'},
    '../db': {
      transaction: async work => work({query: async sql => {
        if (sql.startsWith('SELECT status')) { assert.match(sql, /FOR UPDATE/); return {rows:[{status}]}; }
        if (sql.startsWith('SELECT')) return {rows:sent ? [] : [order()]};
        if (sql.includes('sent_at=NOW()')) sent = true;
        return {rows:[]};
      }}),
    },
    nodemailer: {default: {createTransport: () => ({sendMail: async message => {
      messages.push(message);
      if (messages.length === 1) { status = 'review'; sent = false; }
      return {accepted:['recipient'],rejected:[]};
    }})}},
  }, {process:{env:{SMTP_USER:'sender@example.test',SMTP_PASS:'test'}}});
  await route.deliverPaymentNotifications();
  assert.equal(messages.length, 3);
  assert.match(messages[1].text, /Status: review/);
  assert.match(messages[2].subject, /needs review/);
  assert.equal(sent, true);
});
test('newsletter markup retains formatting but strips active content and disguised URL schemes', () => {
  const sanitizer = load('lib/newsletterHtml.ts', {'sanitize-html': {default: dependency('sanitize-html')}});
  const html = sanitizer.sanitizeNewsletterHtml('<h2>News</h2><strong>Studio</strong><script>alert(1)</script><img src="https://tracker.test" onerror="alert(1)"><a href="jav&#x61;script:alert(1)" onclick="alert(1)">bad</a><a href="//tracker.test">relative</a><iframe src="https://evil.test"></iframe><a href="https://example.test">good</a>');
  assert.match(html, /<h2>News<\/h2>/);
  assert.match(html, /href="https:\/\/example.test"/);
  assert.doesNotMatch(html, /script|onerror|onclick|iframe|tracker\.test/);
});
test('cron authentication rejects multibyte header values without a timing comparison exception', async () => {
  const route = load('app/api/mofolio/studio-cleanup/route.ts', {
    '@/lib/studio/service': {cleanupStudio() {assert.fail('must not run cleanup');}},
    '@/lib/studio/engagement': {queueReviewReminders() {assert.fail('must not queue reminders');}},
    '@/lib/studio/mail': {deliverReviewMail() {assert.fail('must not send mail');}},
    '@/lib/studio/security': {privateHeaders:{'Cache-Control':'no-store'}},
  }, {process:{env:{CRON_SECRET:'abcd'}}});
  assert.equal((await route.GET(new Request('https://example.test', {headers:{authorization:'Bearer éééé'}}))).status, 401);
});
test('newsletter preferences require same-origin POST, bounded input and a scoped token', async () => {
  let writes=0;
  const route=load('app/api/newsletter/preferences/route.ts',{
    '@/lib/requestBody':body,'@/lib/rateLimit':{rateLimit:async()=>null},
    '@/lib/newsletter/server':{validNewsletterToken:token=>typeof token==='string'&&/^[a-f0-9]{64}$/.test(token),changeNewsletterPreference:async()=>{writes++;return true;}},
  });
  const request=(origin,token)=>new Request('https://example.test/api/newsletter/preferences',{method:'POST',headers:{origin},body:JSON.stringify({action:'unsubscribe',token})});
  assert.equal((await route.POST(request('https://attacker.test','a'.repeat(64)))).status,403);
  assert.equal((await route.POST(request('https://example.test','bad'))).status,400);
  assert.equal(writes,0);
  assert.equal((await route.POST(request('https://example.test','a'.repeat(64)))).status,200);
  assert.equal(writes,1);
});
test('patched development glob matcher retains the API used by TypeScript ESLint', () => {
  const parserRequire=createRequire(dependency.resolve('@typescript-eslint/typescript-estree'));
  const matcher=parserRequire('minimatch');
  assert.equal(typeof matcher.minimatch,'function');
  assert.equal(matcher.minimatch('.config.ts','*.ts',{dot:true}),true);
  assert.equal(matcher.minimatch('src/page.ts','src/*.ts',{dot:true}),true);
  assert.equal(matcher.minimatch('src/page.tsx','src/*.ts',{dot:true}),false);
});
test('admin sessions cannot authorize changes submitted from another origin', async () => {
  const auth=load('lib/auth.ts',{}, {process:{env:{ADMIN_SESSION_SECRET:'isolated-admin-key-for-origin-tests'}}});
  const cookie=auth.createAdminSession();
  const request=(origin,site='same-origin',method='POST')=>({url:'https://studio.example.test/api/galleries',method,headers:new Headers({...origin?{origin}:{},'sec-fetch-site':site}),cookies:{get:()=>({value:cookie})}});
  assert.equal(await auth.requireAdmin(request('https://studio.example.test')),null);
  for(const origin of ['https://other.example.test','https://attacker.test','null',undefined]) assert.equal((await auth.requireAdmin(request(origin,'same-site')))?.status,403);
  assert.equal((await auth.requireAdmin(request(undefined,'cross-site','GET')))?.status,403);
  assert.equal((await auth.requireAdmin(request(undefined,'same-origin','GET'),true))?.status,403);
  assert.equal(await auth.requireAdmin(request('https://studio.example.test','same-origin','GET'),true),null);
  const standalone=request('https://studio.example.test');standalone.url='http://localhost:3000/api/galleries';standalone.headers.set('host','studio.example.test');standalone.headers.set('x-forwarded-proto','https');assert.equal(await auth.requireAdmin(standalone),null);
});
test('gallery preview signing never exposes raw/video originals and rasterizes image previews', () => {
  const calls=[];
  const media=load('lib/privateMedia.ts',{cloudinary:{v2:{config(){},url:(id,options)=>{calls.push({id,options});return 'synthetic-preview';}}}}, {process:{env:{CLOUDINARY_CLOUD_NAME:'audit-cloud'}}});
  assert.equal(media.signedGalleryPreview('https://res.cloudinary.com/audit-cloud/raw/authenticated/v1/private-book.zip'),null);
  assert.equal(media.signedGalleryPreview('https://res.cloudinary.com/audit-cloud/video/authenticated/v1/movie.mp4'),null);
  assert.equal(calls.length,0);
  assert.equal(media.signedGalleryPreview('https://res.cloudinary.com/audit-cloud/image/authenticated/v1/vector.svg'),'synthetic-preview');
  assert.equal(calls[0].options.format,'jpg');
  assert.equal(calls[0].options.page,1);
  assert.equal(calls[0].options.width,1200);
  assert.equal(calls[0].options.quality,75);
});
test('logout rejects another origin before changing any cookie', async () => {
  const auth=load('lib/auth.ts',{}, {process:{env:{ADMIN_SESSION_SECRET:'isolated-admin-key-for-origin-tests'}}});
  const route=load('app/api/admin/logout/route.ts',{'@/lib/auth':auth,'@/lib/adminSessions':{revokeAdminSession:async()=>{}}});
  const response=await route.POST(new Request('https://studio.example.test/api/admin/logout',{method:'POST',headers:{origin:'https://other.example.test','sec-fetch-site':'same-site'}}));
  assert.equal(response.status,403);
});
test('authorized image delivery is not delayed by SMTP notification work', {timeout:1000}, async () => {
  const jobs=[];
  const route=load('app/api/galleries/download/route.ts',{
    'next/server':{...next,after:job=>jobs.push(job)},
    '@/lib/db':{query:async()=>({rows:[{access_code:'fixture',client_name:'Synthetic client',finished_images:['https://res.cloudinary.com/audit/image/authenticated/v1/one.jpg'],payment_verified:true,is_locked:false}]})},
    '@/lib/rateLimit':{rateLimit:async()=>null},
    '@/lib/galleryAccess':{hasGalleryCookie:()=>true},
    '@/lib/privateMedia':{parseAuthenticatedAsset:()=>({resourceType:'image'}),temporaryOriginalUrl:()=> 'https://provider.example.test/private-file'},
    '@/lib/payments/server':{verifyGallerySettlement:async()=>true},
    nodemailer:{default:{createTransport(){assert.fail('SMTP must be deferred until after the response');}}},
  },{fetch:async()=>new Response('synthetic image'),process:{env:{SMTP_USER:'sender@example.test',SMTP_PASS:'not-real'}}});
  const response=await route.GET(new Request('https://studio.example.test/api/galleries/download?galleryId=1&index=0'));
  assert.equal(response.status,200);
  assert.equal(await response.text(),'synthetic image');
  assert.equal(jobs.length,1);
});

test('AI privacy checks cover encoded portal URLs, Unicode disguises and common pasted credentials', () => {
  for (const value of [
    '/api/bookings/portal/private-token', '/api/art-inquiries/portal/private-token',
    '%252Fclient%252Fbooking%252Fprivate-token', 'ｐａｓｓｗｏｒｄ： secret-value',
    'customer\u200b@example.test', 'Bearer fake-token-value-1234567890',
    '-----BEGIN PRIVATE KEY-----', '08012345678', '+1 (202) 555-0123',
  ]) assert.equal(privacy.containsPrivateDetails(value), true, value);
  for (const value of ['Which package costs NGN 100000?', 'Does Stillbounds sync my books?', 'How do I recover my purchase?']) assert.equal(privacy.containsPrivateDetails(value), false, value);
});

test('gallery previews reject missing sessions, locked galleries and invalid indices before fetching', async () => {
  for (const [cookie, locked] of [[false, false], [true, true]]) {
    const route = load('app/api/galleries/preview/route.ts', {
      '@/lib/db': {query: async () => ({rows:[{access_code:'test',is_locked:locked,images:['source.jpg']}]})},
      '@/lib/galleryAccess': {hasGalleryCookie: () => cookie},
      '@/lib/privateMedia': {signedGalleryPreview() {assert.fail('must authorize first');}},
      sharp: {},
    }, {fetch() {assert.fail('must authorize first');}});
    const response = await route.GET(new Request('https://example.test/api/galleries/preview?galleryId=1&index=0&collection=proofs'));
    assert.equal(response.status,403);
    assert.equal(response.headers.get('cache-control'),'private, no-store');
    assert.equal((await route.GET(new Request('https://example.test/api/galleries/preview?galleryId=1&index=-1&collection=proofs'))).status,400);
  }
});

test('gallery previews bake a watermark into bounded JPEG bytes without redirecting to the source', async () => {
  const sharp = dependency('sharp');
  const input = await sharp({create:{width:1600,height:800,channels:3,background:'#303030'}}).png().toBuffer();
  const route = load('app/api/galleries/preview/route.ts', {
    '@/lib/db':{query:async()=>({rows:[{access_code:'test',images:['private-original.jpg']}]})},
    '@/lib/galleryAccess':{hasGalleryCookie:()=>true},
    '@/lib/privateMedia':{signedGalleryPreview:()=> 'https://provider.test/signed'},
    sharp:{default:sharp},
  }, {fetch:async()=>new Response(input)});
  const response = await route.GET(new Request('https://example.test/api/galleries/preview?galleryId=7&index=0&collection=proofs'));
  assert.equal(response.status,200);
  assert.equal(response.headers.get('location'),null);
  assert.equal(response.headers.get('content-type'),'image/jpeg');
  const image = Buffer.from(await response.arrayBuffer());
  const metadata = await sharp(image).metadata();
  assert.equal(metadata.width,1200);
  assert.equal(metadata.height,600);
  const stats = await sharp(image).stats();
  assert.ok(stats.channels[0].stdev > 1, 'watermark must change the uniform input pixels');
});

test('gallery selections resolve scoped preview references to server-side originals', async () => {
  let saved;
  const route = load('app/api/galleries/approve-selection/route.ts', {
    '@/lib/requestBody':body,
    '@/lib/rateLimit':{rateLimit:async()=>null},
    '@/lib/db':{query:async(sql,params)=>{
      if(sql.startsWith('SELECT')) return {rows:[{images:['secret-original.jpg'],is_locked:false}]};
      saved = params[0]; return {rows:[]};
    }},
  });
  const reference = '/api/galleries/preview?galleryId=7&index=0&collection=proofs';
  const request = images => new Request('https://example.test',{method:'POST',body:JSON.stringify({accessCode:'test',galleryId:7,images})});
  const result = await route.POST(request([reference]));
  assert.equal(result.status,200);
  assert.equal(saved[0],'secret-original.jpg');
  assert.deepEqual((await result.json()).approved_images,[reference]);
  assert.equal((await route.POST(request([reference.replace('galleryId=7','galleryId=8')]))).status,400);
  assert.equal((await route.POST(request(['secret-original.jpg']))).status,400);
});

test('finished downloads preserve preview indices when an earlier file is unsupported', async () => {
  let fetched;
  const route = load('app/api/galleries/download/route.ts', {
    'next/server':{...next,after(){}},
    '@/lib/db':{query:async()=>({rows:[{access_code:'test',finished_images:['https://source.test/unsupported.zip','https://source.test/second.jpg'],payment_verified:true}]})},
    '@/lib/rateLimit':{rateLimit:async()=>null},
    '@/lib/galleryAccess':{hasGalleryCookie:()=>true},
    '@/lib/privateMedia':{parseAuthenticatedAsset:src=>({resourceType:src.endsWith('.jpg')?'image':'raw'}),temporaryOriginalUrl:src=>src.replace('source.test','provider.test')},
    '@/lib/payments/server':{verifyGallerySettlement:async()=>true},
    nodemailer:{},
  },{fetch:async url=>{fetched=String(url);return new Response('image');}});
  assert.equal((await route.GET(new Request('https://example.test/api/galleries/download?galleryId=1&index=0'))).status,403);
  assert.equal(fetched,undefined);
  assert.equal((await route.GET(new Request('https://example.test/api/galleries/download?galleryId=1&index=1'))).status,200);
  assert.equal(fetched,'https://provider.test/second.jpg');
});

test('installed Stillbounds betas receive their pinned approval address after the website domain migration', async () => {
  const issued = {device_code:'synthetic-private-device-code',user_code:'ABCD1234',verification_uri:'https://moyoayaworan.com/mofolio/account',verification_uri_complete:'https://moyoayaworan.com/mofolio/account?user_code=ABCD1234',expires_in:600,interval:5};
  const route = load('app/api/stillbounds/auth/[...all]/route.ts', {
    '@/lib/stillboundsAuth': {stillboundsAuth:()=>({handler:async()=>Response.json(issued,{headers:{'Content-Length':'999','X-Fixture':'preserved'}})})},
  }, {Headers});
  for (const origin of ['https://moyo-roan.vercel.app','https://moyoayaworan.com','https://untrusted.example']) {
    const response = await route.POST(new Request(origin+'/api/stillbounds/auth/device/code',{method:'POST'}));
    assert.equal(response.status,200);
    const data = await response.json();
    const expected = origin === 'https://moyo-roan.vercel.app' ? origin : 'https://moyoayaworan.com';
    assert.equal(data.verification_uri,expected+'/mofolio/account');
    assert.equal(data.verification_uri_complete,expected+'/mofolio/account?user_code=ABCD1234');
    assert.equal(data.device_code,issued.device_code);
    assert.equal(data.expires_in,600);
    assert.equal(data.interval,5);
    assert.equal(response.headers.get('cache-control'),'private, no-store');
    assert.equal(response.headers.get('referrer-policy'),'no-referrer');
    assert.equal(response.headers.get('x-fixture'),'preserved');
    if (origin === 'https://moyo-roan.vercel.app') assert.equal(response.headers.get('content-length'),null);
  }
  const unrelated = await route.GET(new Request('https://moyo-roan.vercel.app/api/stillbounds/auth/get-session'));
  assert.equal((await unrelated.json()).verification_uri,issued.verification_uri);
  const failed = load('app/api/stillbounds/auth/[...all]/route.ts',{
    '@/lib/stillboundsAuth':{stillboundsAuth:()=>({handler:async()=>Response.json({error:'rate_limited'},{status:429})})},
  },{Headers});
  const failure = await failed.POST(new Request('https://moyo-roan.vercel.app/api/stillbounds/auth/device/code',{method:'POST'}));
  assert.equal(failure.status,429);
  assert.deepEqual(await failure.json(),{error:'rate_limited'});
});
