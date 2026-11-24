import { createHash } from 'node:crypto';
import { studioQuery, studioTransaction } from '@/lib/studio/db';
import { assertStudio } from '@/lib/studio/protocol';
export const feedbackStatuses = ['new', 'investigating', 'fixed', 'closed'] as const;
export type FeedbackStatus = typeof feedbackStatuses[number];
export type FeedbackReport = {
  id: string; kind: 'bug' | 'idea' | 'other'; title: string; message: string; steps: string; replyTo: string;
  diagnostics?: { appVersion: string; osVersion: string; platform: 'darwin'; architecture: 'arm64' | 'x64' };
};
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
function text(value: unknown, min: number, max: number, label: string) {
  assertStudio(typeof value === 'string' && !value.includes('\0'), `Invalid ${label}.`);
  const result = value.trim();
  assertStudio(result.length >= min && result.length <= max, `Invalid ${label}.`);
  return result;
}
export function feedbackInput(raw: unknown): FeedbackReport {
  assertStudio(raw && typeof raw === 'object' && !Array.isArray(raw), 'Invalid report.');
  const v = raw as Record<string, unknown>;
  assertStudio(Object.keys(v).every(k => ['id','kind','title','message','steps','replyTo','diagnostics'].includes(k)), 'Unexpected report field.');
  assertStudio(typeof v.id === 'string' && uuid.test(v.id), 'Invalid report reference.');
  assertStudio(['bug','idea','other'].includes(String(v.kind)), 'Invalid report type.');
  const replyTo = text(v.replyTo, 0, 254, 'reply email');
  assertStudio(!replyTo || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo), 'Invalid reply email.');
  let diagnostics: FeedbackReport['diagnostics'];
  if (v.diagnostics !== undefined) {
    assertStudio(v.diagnostics && typeof v.diagnostics === 'object' && !Array.isArray(v.diagnostics), 'Invalid system details.');
    const d = v.diagnostics as Record<string, unknown>;
    assertStudio(Object.keys(d).length === 4 && Object.keys(d).every(k => ['appVersion','osVersion','platform','architecture'].includes(k)), 'Unexpected system details.');
    assertStudio(typeof d.appVersion === 'string' && /^[A-Za-z0-9.+_-]{1,80}$/.test(d.appVersion) &&
      typeof d.osVersion === 'string' && /^[A-Za-z0-9.+_-]{1,80}$/.test(d.osVersion) &&
      d.platform === 'darwin' && ['arm64','x64'].includes(String(d.architecture)), 'Invalid system details.');
    diagnostics = { appVersion: d.appVersion, osVersion: d.osVersion, platform: 'darwin', architecture: d.architecture as 'arm64'|'x64' };
  }
  return { id: v.id.toLowerCase(), kind: v.kind as FeedbackReport['kind'], title: text(v.title,3,160,'title'),
    message: text(v.message,20,8000,'description'), steps: text(v.steps,0,4000,'steps'), replyTo,
    ...(diagnostics ? { diagnostics } : {}) };
}
const schema = `CREATE TABLE IF NOT EXISTS stillbounds_app_feedback (
 id UUID PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('bug','idea','other')),
 title TEXT NOT NULL, message TEXT NOT NULL, steps TEXT NOT NULL, reply_to TEXT NOT NULL,
 diagnostics JSONB, content_hash TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','investigating','fixed','closed')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS stillbounds_feedback_created ON stillbounds_app_feedback(created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS stillbounds_feedback_status ON stillbounds_app_feedback(status,created_at DESC,id DESC);`;
let initialized: Promise<void> | undefined;
async function ready() {
  if (!initialized) initialized = studioTransaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(178931, 53)');
    await client.query(schema);
  }).catch(error => { initialized = undefined; throw error; });
  await initialized;
}
export async function createFeedback(raw: unknown) {
  const report = feedbackInput(raw);
  const digest = createHash('sha256').update(JSON.stringify(report)).digest('hex');
  await ready();
  const result = await studioQuery(`INSERT INTO stillbounds_app_feedback(id,kind,title,message,steps,reply_to,diagnostics,content_hash)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO NOTHING RETURNING id`,
    [report.id, report.kind, report.title, report.message, report.steps, report.replyTo, report.diagnostics ? JSON.stringify(report.diagnostics) : null, digest]);
  if (!result.rows.length) {
    const existing = await studioQuery('SELECT content_hash FROM stillbounds_app_feedback WHERE id=$1',[report.id]);
    assertStudio(existing.rows[0]?.content_hash === digest, 'Report reference already used for different details.',409);
  }
  return { id: report.id };
}
export async function listFeedback(status: string, page: number) {
  assertStudio(status === 'all' || feedbackStatuses.includes(status as FeedbackStatus),'Invalid status.');
  assertStudio(Number.isInteger(page) && page >= 0 && page <= 1000,'Invalid page.');
  await ready();
  const result = await studioQuery(`SELECT id,kind,title,message,steps,reply_to AS "replyTo",diagnostics,status,
    created_at AS "createdAt",updated_at AS "updatedAt" FROM stillbounds_app_feedback
    WHERE ($1='all' OR status=$1) ORDER BY created_at DESC,id DESC LIMIT 31 OFFSET $2`,[status,page*30]);
  return { reports: result.rows.slice(0,30), hasMore: result.rows.length > 30, page };
}
export async function updateFeedback(raw: unknown) {
  assertStudio(raw && typeof raw === 'object' && !Array.isArray(raw),'Invalid update.');
  const v = raw as Record<string,unknown>;
  assertStudio(Object.keys(v).length === 2 && Object.keys(v).every(k => ['id','status'].includes(k)) &&
    typeof v.id === 'string' && uuid.test(v.id) && feedbackStatuses.includes(v.status as FeedbackStatus),'Invalid update.');
  await ready();
  const result = await studioQuery('UPDATE stillbounds_app_feedback SET status=$2,updated_at=NOW() WHERE id=$1 RETURNING id,status',[v.id,v.status]);
  assertStudio(result.rows.length,'Report not found.',404);
  return result.rows[0];
}
