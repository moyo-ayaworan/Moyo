import {readFile,mkdir,writeFile} from 'node:fs/promises';
import pg from 'pg';
try{process.loadEnvFile('.env.local');}catch{}
const sql=await readFile(new URL('../lib/stillbounds/billing-schema.sql',import.meta.url),'utf8');
await mkdir('output',{recursive:true});await writeFile('output/stillbounds-billing-migration.sql',sql);
console.log('Dedicated Stillbounds licensing schema prepared; existing account and product tables are unchanged.');
if(process.argv.includes('--apply')){const url=new URL(process.env.DATABASE_URL);if(url.searchParams.has('sslmode'))url.searchParams.set('sslmode','verify-full');url.searchParams.delete('uselibpqcompat');const pool=new pg.Pool({connectionString:url.href,ssl:{rejectUnauthorized:true},max:1});const c=await pool.connect();try{await c.query('BEGIN');await c.query("SELECT pg_advisory_xact_lock(hashtext('stillbounds-license-schema-v1'))");await c.query(sql);await c.query('COMMIT');console.log('Dedicated licensing tables are ready.');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();await pool.end();}}
