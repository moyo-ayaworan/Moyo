import { readJsonRequest } from '@/lib/requestBody';
import { sendNewsletterCampaign } from '@/lib/newsletter/server';
import { after, NextRequest, NextResponse } from 'next/server';
import {deliverNewsletterCampaigns} from '@/lib/newsletter/queue';
import { requireAdmin } from '@/lib/auth';

export const maxDuration = 60;

const validLists = new Set(['all', 'photography', 'art']);

function normalize(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatBody(body: string) {
  return escapeHtml(body)
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br />')}</p>`)
    .join('');
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin(req);
  if (unauthorized) return unauthorized;

  const parsed = await readJsonRequest(req, 100_000);
  if (parsed.response) return parsed.response;
  const body = parsed.body;
  const requestKey=typeof body.requestKey==='string'?body.requestKey:'';
  if(!/^[a-f0-9-]{36}$/i.test(requestKey))return NextResponse.json({error:'Reload the newsletter editor before sending.'},{status:400});
  const listType = normalize(body.listType) || 'all';
  const subject = normalize(body.subject);
  const message = normalize(body.message);
  const previewText = normalize(body.previewText);

  if (!validLists.has(listType)) {
    return NextResponse.json({ error: 'Choose a valid newsletter list.' }, { status: 400 });
  }

  if (!subject || !message || subject.length > 200 || previewText.length > 500) {
    return NextResponse.json({ error: 'Subject and message are required.' }, { status: 400 });
  }

  const htmlBody = formatBody(message);
  const html = `
    <div style="margin:0;background:#050505;color:#f7f7f7;font-family:Inter,Arial,sans-serif;padding:32px;">
      <div style="max-width:640px;margin:0 auto;border:1px solid rgba(146,1,16,.35);padding:32px;">
        <p style="margin:0 0 24px;color:#920110;font-size:11px;letter-spacing:.28em;text-transform:uppercase;">Ijabiken Moyo</p>
        <h1 style="font-family:Georgia,serif;font-weight:400;font-style:italic;margin:0 0 18px;font-size:32px;color:#fff;">${escapeHtml(subject)}</h1>
        ${previewText ? `<p style="color:#aaa;margin:0 0 28px;line-height:1.7;">${escapeHtml(previewText)}</p>` : ''}
        <div style="color:#e8e8e8;line-height:1.75;font-size:15px;">${htmlBody}</div>
        <p style="margin:32px 0 0;color:#777;font-size:11px;letter-spacing:.12em;text-transform:uppercase;">You are receiving this because you subscribed to Moyo updates.</p>
      </div>
    </div>
  `;

  try {
    const result = await sendNewsletterCampaign({requestKey,listType,subject,text:message,html});
    if(result.queuedCount){after(()=>deliverNewsletterCampaigns({limit:3}));return NextResponse.json({...result,message:`Campaign saved for ${result.queuedCount} recipients. Delivery continues in the background.`},{status:202,headers:{'Cache-Control':'no-store'}});}
    if (!result.sentCount && !result.failedCount) return NextResponse.json({error:'No active subscribers for this list.'},{status:400});
    return NextResponse.json({...result,sent:result.sentCount,message:`Sent to ${result.sentCount} recipients.${result.failedCount ? ` ${result.failedCount} deliveries could not be confirmed.` : ''}`},{status:result.sentCount ? 200 : 502});
  } catch { return NextResponse.json({error:'Newsletter delivery is unavailable.'},{status:503}); }
}
