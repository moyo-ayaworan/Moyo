import { readJsonRequest } from '@/lib/requestBody';
import { sanitizeNewsletterHtml } from '@/lib/newsletterHtml';
import { NextRequest, NextResponse } from 'next/server';
import { sendNewsletterCampaign } from '@/lib/newsletter/server';
import { requireAdmin } from '@/lib/auth';
import { query } from '@/lib/db';

type ListType = 'all' | 'photography' | 'art';

export const maxDuration = 60;

const validLists = new Set<ListType>(['all', 'photography', 'art']);

function normalizeList(value: unknown): ListType {
  return typeof value === 'string' && validLists.has(value as ListType) ? (value as ListType) : 'all';
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function htmlToText(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function textToEmailHtml(body: string, previewText?: string) {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => {
      const text = escapeHtml(paragraph).replace(/\n/g, '<br />');
      return '<p style="margin:0 0 18px;line-height:1.7;">' + text + '</p>';
    })
    .join('');

  return wrapEmailHtml(paragraphs, previewText);
}

function wrapEmailHtml(contentHtml: string, previewText?: string) {
  return [
    '<!doctype html>',
    '<html>',
    '<body style="margin:0;background:#050505;color:#fafafa;font-family:Arial,sans-serif;">',
    '<div style="display:none;max-height:0;overflow:hidden;color:transparent;">' + escapeHtml(previewText || '') + '</div>',
    '<main style="max-width:640px;margin:0 auto;padding:44px 24px;">',
    '<p style="margin:0 0 24px;color:#920110;font-size:11px;letter-spacing:0.35em;text-transform:uppercase;">Ijabiken Moyo</p>',
    '<div style="font-size:16px;color:#f5f5f5;line-height:1.7;">' + contentHtml + '</div>',
    '<hr style="border:none;border-top:1px solid rgba(255,255,255,0.12);margin:34px 0;" />',
    '<p style="margin:0;color:rgba(255,255,255,0.42);font-size:12px;line-height:1.6;">You are receiving this because you subscribed to Ijabiken Moyo updates.</p>',
    '</main>',
    '</body>',
    '</html>',
  ].join('');
}

async function getRecipients(listType: ListType) {
  const params = listType === 'all' ? [] : [listType];
  const where = listType === 'all' ? "status = 'active'" : "status = 'active' AND list_type = $1";
  const { rows } = await query(
    `SELECT id, email, list_type, subscribed_at, last_emailed_at
     FROM newsletter_subscribers
     WHERE ${where}
     ORDER BY subscribed_at DESC`,
    params
  );
  return rows;
}

export async function GET(req: NextRequest) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  const listType = normalizeList(req.nextUrl.searchParams.get('listType'));
  const [subscribers, counts] = await Promise.all([
    getRecipients(listType),
    query(
      `SELECT list_type, COUNT(*)::int AS count
       FROM newsletter_subscribers
       WHERE status = 'active'
       GROUP BY list_type`
    ),
  ]);

  return NextResponse.json({ subscribers, counts: counts.rows });
}

export async function POST(req: NextRequest) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  const parsed = await readJsonRequest(req, 100_000);
  if (parsed.response) return parsed.response;
  const body = parsed.body;
  if (body.listType !== undefined && !validLists.has(body.listType)) return NextResponse.json({error:'Choose a valid newsletter list.'},{status:400});
  const listType = normalizeList(body.listType);
  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  const previewText = typeof body.previewText === 'string' ? body.previewText.trim() : '';
  const bodyText = typeof body.body === 'string' ? body.body.trim() : '';
  const bodyHtml = typeof body.bodyHtml === 'string' ? sanitizeNewsletterHtml(body.bodyHtml.trim()) : '';
  const fallbackText = htmlToText(bodyHtml);

  if (subject.length > 200 || previewText.length > 500) return NextResponse.json({ error: 'Subject or preview text is too long.' }, { status: 400 });
  if (!subject) return NextResponse.json({ error: 'Subject is required.' }, { status: 400 });
  if (!bodyText && !fallbackText) {
    return NextResponse.json({ error: 'Newsletter body is required.' }, { status: 400 });
  }
  try {
    const result = await sendNewsletterCampaign({listType,subject,text:bodyText || fallbackText,html:bodyHtml ? wrapEmailHtml(bodyHtml,previewText) : textToEmailHtml(bodyText,previewText)});
    if (!result.sentCount && !result.failedCount) return NextResponse.json({error:'No active subscribers found for this list.'},{status:400});
    return NextResponse.json({...result,message:`Sent to ${result.sentCount} recipients.${result.failedCount ? ` ${result.failedCount} deliveries could not be confirmed.` : ''}`},{status:result.sentCount ? 200 : 502});
  } catch { return NextResponse.json({error:'Newsletter delivery is unavailable.'},{status:503}); }
}
