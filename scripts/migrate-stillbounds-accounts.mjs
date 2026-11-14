import { promises as fs } from 'node:fs';
import { getMigrations } from 'better-auth/db/migration';
import { stillboundsAuth } from '../lib/stillboundsAuth.ts';
try { process.loadEnvFile('.env.local'); } catch {}
const plan = await getMigrations(stillboundsAuth().options);
const newTables = new Set(plan.toBeCreated.map(t => t.table));
if (plan.unsafeChanges.length || plan.schemaProblems.length || plan.toBeAdded.length || plan.toBeAddedIndexes.some(i => !newTables.has(i.table)) || plan.toBeCreated.some(t => !t.table.startsWith('stillbounds_auth_'))) {
  throw new Error('Unexpected account schema changes; inspect the migration manually.');
}
await fs.mkdir('output', { recursive: true });
await fs.writeFile('output/stillbounds-account-migration.sql', await plan.compileMigrations());
console.log(`Account migration: ${plan.toBeCreated.length} new dedicated tables. SQL saved to output/stillbounds-account-migration.sql.`);
if (process.argv.includes('--apply')) {
  await plan.runMigrations();
  console.log('Stillbounds account tables are ready.');
}
process.exit(0);
