import { readJsonRequest } from '@/lib/requestBody';
import { NextResponse, type NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { rateLimit } from '@/lib/rateLimit';
import { requireAdmin } from '@/lib/auth';
import { stillboundsLegalVersion } from '@/lib/stillboundsLegal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = {'Cache-Control':'no-store'};
async function ensureList() {
  await query(`CREATE TABLE IF NOT EXISTS mofolio_beta_requests (email TEXT PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), consent_version TEXT NOT NULL)`);
  await query(`ALTER TABLE mofolio_beta_requests
    ADD COLUMN IF NOT EXISTS terms_version TEXT,
    ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS privacy_version TEXT,
    ADD COLUMN IF NOT EXISTS marketing_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS marketing_consent_version TEXT,
    ADD COLUMN IF NOT EXISTS marketing_consent_at TIMESTAMPTZ`);
}
export async function POST(request:Request) {
  try {
    const parsed = await readJsonRequest(request, 1000);
    if (parsed.response) return parsed.response;
    const body: Record<string, unknown> = parsed.body;
    const email = typeof body.email==='string' ? body.email.trim().toLowerCase() : '';
    if(email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({error:'Enter a valid email address.'},{status:400,headers});
    if(body.termsAccepted !== true) return NextResponse.json({error:'Please agree to the Stillbounds beta terms.'},{status:400,headers});
    if(body.marketingConsent !== undefined && typeof body.marketingConsent !== 'boolean') return NextResponse.json({error:'Invalid product-update preference.'},{status:400,headers});
    if(body.website) return NextResponse.json({ok:true},{headers});
    const limited = await rateLimit(request,'mofolio-beta',5,3600);
    if(limited) return limited;
    await ensureList();
    const marketing = body.marketingConsent === true;
    await query(`INSERT INTO mofolio_beta_requests
      (email, consent_version, terms_version, terms_accepted_at, privacy_version, marketing_opt_in, marketing_consent_version, marketing_consent_at)
      VALUES ($1, $2, $2, NOW(), $2, $3, CASE WHEN $3 THEN $2 ELSE NULL END, CASE WHEN $3 THEN NOW() ELSE NULL END)
      ON CONFLICT (email) DO NOTHING RETURNING email`,[email,stillboundsLegalVersion,marketing]);
    return NextResponse.json({ok:true},{headers});
  } catch {return NextResponse.json({error:'We could not save your request. Please try again later.'},{status:503,headers});}
}
export async function GET(request:NextRequest) {
  const denied = await requireAdmin(request);
  if(denied) return denied;
  try {
    await ensureList();
    const {rows}=await query('SELECT email, created_at, terms_version, marketing_opt_in, marketing_consent_at FROM mofolio_beta_requests ORDER BY created_at DESC LIMIT 500');
    return NextResponse.json({requests:rows},{headers});
  } catch {return NextResponse.json({error:'Unable to load beta requests.'},{status:503,headers});}
}
