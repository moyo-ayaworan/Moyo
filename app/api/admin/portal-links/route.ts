import {randomBytes} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {requireAdmin} from '@/lib/auth';
import {query} from '@/lib/db';
import {readJsonRequest} from '@/lib/requestBody';
export async function POST(request:NextRequest){
 const denied=await requireAdmin(request,true);if(denied)return denied;
 const parsed=await readJsonRequest(request,1024);if(parsed.response)return parsed.response;
 const {kind,id,action}=parsed.body;
 if(!['booking','collector'].includes(String(kind))||!Number.isSafeInteger(id)||Number(id)<=0||!['renew','revoke'].includes(String(action)))return NextResponse.json({error:'Choose a valid private link action.'},{status:400});
 const table=kind==='booking'?'bookings':'art_inquiries';
 const result=action==='revoke'
  ?await query(`UPDATE ${table} SET portal_revoked_at=NOW() WHERE id=$1 RETURNING manage_token,portal_expires_at::text,portal_revoked_at::text`,[id])
  :await query(`UPDATE ${table} SET manage_token=$2,portal_expires_at=NOW()+INTERVAL '180 days',portal_revoked_at=NULL WHERE id=$1 RETURNING manage_token,portal_expires_at::text,portal_revoked_at::text`,[id,randomBytes(24).toString('hex')]);
 if(!result.rows[0])return NextResponse.json({error:'Record not found.'},{status:404});
 return NextResponse.json({link:result.rows[0]},{headers:{'Cache-Control':'private, no-store'}});
}
