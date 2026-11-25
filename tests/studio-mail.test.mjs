import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const module={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/studioMail.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module,exports:module.exports});
const {applyStudioMailEnvironment}=module.exports;
test('absent or malformed new Gmail credential preserves the existing working transport',()=>{
 for(const password of [undefined,'','  ','invalid']){
  const env={MOYO_GMAIL_APP_PASSWORD:password,SMTP_USER:'existing@example.test',EMAIL_PASS:'existing-secret',SMTP_HOST:'existing.smtp.test'};
  const before={...env};assert.equal(applyStudioMailEnvironment(env),false);assert.deepEqual(env,before);
 }
});
test('one new Gmail credential switches every legacy mail transport together',()=>{
 const env={MOYO_GMAIL_APP_PASSWORD:'abcd efgh ijkl mnop',SMTP_USER:'existing@example.test',EMAIL_USER:'existing@example.test',SMTP_PASS:'old-secret',EMAIL_PASS:'old-secret',SMTP_HOST:'old.smtp.test',EMAIL_SERVER_HOST:'old.smtp.test',UNRELATED:'keep'};
 assert.equal(applyStudioMailEnvironment(env),true);
 for(const key of ['SMTP_USER','EMAIL_USER','EMAIL_SERVER_USER','MAIL_USER','SMTP_FROM','EMAIL_FROM','MAIL_FROM','CONTACT_EMAIL','SMTP_REPLY_TO','OPERATIONS_ALERT_TO'])assert.equal(env[key],'moyoayaworan@gmail.com');
 for(const key of ['SMTP_PASS','EMAIL_PASS','MAIL_PASS','SMTP_PASSWORD','EMAIL_SERVER_PASSWORD'])assert.equal(env[key],'abcdefghijklmnop');
 for(const key of ['SMTP_HOST','EMAIL_HOST','MAIL_HOST','EMAIL_SERVER_HOST'])assert.equal(env[key],'smtp.gmail.com');
 for(const key of ['SMTP_PORT','EMAIL_PORT','MAIL_PORT','EMAIL_SERVER_PORT'])assert.equal(env[key],'465');
 assert.equal(env.UNRELATED,'keep');
});

test('the existing protected credential key is supported without reading it back',()=>{
 const env={OYO_GMAIL_APP_PASSWORD:'abcd efgh ijkl mnop'};
 assert.equal(applyStudioMailEnvironment(env),true);
 assert.equal(env.EMAIL_USER,'moyoayaworan@gmail.com');assert.equal(env.EMAIL_PASS,'abcdefghijklmnop');
});
