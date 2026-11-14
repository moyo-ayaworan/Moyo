// Read-only, repeatable inventory. This is static evidence, not a proof of security.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';
const roots = ['app','components','context','lib','scripts','tests','public'];
const extensions = new Set(['.ts','.tsx','.js','.mjs','.css','.sql','.svg']);
const files = [];
function walk(dir) {
  for (const item of fs.readdirSync(dir,{withFileTypes:true})) {
    const name = path.join(dir,item.name);
    if (item.isDirectory()) walk(name);
    else if (extensions.has(path.extname(name))) files.push(name);
  }
}
for (const root of roots) walk(root);
for (const name of ['next.config.ts','proxy.ts','eslint.config.mjs','postcss.config.mjs','package.json','tsconfig.json','vercel.json','.vercelignore','.gitignore','lib/catalog.json']) if(fs.existsSync(name)&&!files.includes(name))files.push(name);
const checks = [
  ['raw-html',/dangerouslySetInnerHTML|\.innerHTML\b/],
  ['dynamic-code',/\beval\s*\(|new Function\s*\(|\bexecSync\s*\(|\bexec\s*\(|\bspawn\s*\(/],
  ['network',/\bfetch\s*\(|\bXMLHttpRequest\b/],
  ['database',/\b(?:query|transaction)\s*\(/],
  ['filesystem',/\b(?:readFile|writeFile|unlink|rm|createWriteStream)(?:Sync)?\s*\(/],
  ['navigation',/\bredirect\s*\(|\b(?:router|location)\.(?:push|replace|href)\b/],
  ['browser-storage',/\b(?:localStorage|sessionStorage|setStorageItem)\b/],
  ['credential-literal',/\b(?:sk_live_|whsec_)[A-Za-z0-9_-]{24,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['svg-active-content',/<script\b|\bon\w+\s*=|<foreignObject\b/i],
];
const parsed = new Map();
const entries = files.sort().map(file=>{
  const source=fs.readFileSync(file,'utf8');
  const script=/\.(?:ts|tsx|js|mjs)$/.test(file);
  const markers=[];
  source.split('\n').forEach((line,index)=>{for(const [check,pattern] of checks)if((check!=='svg-active-content'||file.endsWith('.svg'))&&pattern.test(line))markers.push({check,line:index+1});});
  let imports=[],routeMethods=[],parseErrors=[];
  if(script){
    const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
    parsed.set(file,{source,ast});
    imports=ast.statements.filter(ts.isImportDeclaration).map(n=>n.moduleSpecifier.text);
    routeMethods=ast.statements.filter(ts.isFunctionDeclaration).map(n=>n.name?.text).filter(n=>['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'].includes(n));
    parseErrors=ast.parseDiagnostics.map(d=>({line:ast.getLineAndCharacterOfPosition(d.start??0).line+1,code:d.code}));
  }
  return {path:file,lines:source.split('\n').length,sha256:crypto.createHash('sha256').update(source).digest('hex'),review:'static scan; manual coverage recorded separately',imports,routeMethods,markers,parseErrors};
});
function resolve(file,name){const base=name.startsWith('@/')?name.slice(2):name.startsWith('.')?path.join(path.dirname(file),name):null;if(!base)return null;for(const candidate of [base,base+'.ts',base+'.tsx',path.join(base,'index.ts'),path.join(base,'index.tsx')])if(parsed.has(candidate))return candidate;return null;}
const clientLeaks=[];
function visit(file,chain,seen){if(seen.has(file))return;seen.add(file);const entry=entries.find(e=>e.path===file);for(const name of entry?.imports||[]){if(/^(?:node:)?(?:pg|nodemailer|fs|child_process)$/.test(name)||/^@\/lib\/(?:db|auth|privateMedia|stillboundsAuth|payments\/server)$/.test(name))clientLeaks.push([...chain,file,name]);const target=resolve(file,name);if(target)visit(target,[...chain,file],seen);}}
for(const [file,{source}]of parsed)if(/^\s*['"]use client['"]/.test(source))visit(file,[],new Set());
const report={generatedAt:new Date().toISOString(),scope:'First-party source/config and public SVG. Excludes .env values, generated outputs, dependencies, lockfile contents, binaries and non-code documents.',files:entries.length,lines:entries.reduce((n,e)=>n+e.lines,0),parseErrors:entries.flatMap(e=>e.parseErrors.map(v=>({file:e.path,...v}))),clientServerImportPaths:clientLeaks,entries};
fs.mkdirSync('output',{recursive:true});fs.writeFileSync('output/code-audit-static.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({files:report.files,lines:report.lines,parseErrors:report.parseErrors,clientServerImportPaths:clientLeaks,markerCounts:Object.fromEntries(checks.map(([name])=>[name,entries.reduce((n,e)=>n+e.markers.filter(m=>m.check===name).length,0)]))},null,2));
