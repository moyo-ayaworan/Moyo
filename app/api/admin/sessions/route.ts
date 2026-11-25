import {NextRequest,NextResponse} from 'next/server';
import {ADMIN_COOKIE,requireAdmin} from '@/lib/auth';
import {adminTokenHash} from '@/lib/adminSessions';
import {query} from '@/lib/db';
import {readJsonRequest} from '@/lib/requestBody';
const headers={'Cache-Control':'private, no-store'};
export async function GET(request:NextRequest){
 const denied=await requireAdmin(request);if(denied)return denied;
 const tokenHash=adminTokenHash(request.cookies.get(ADMIN_COOKIE)!.value);
 const result=await query('SELECT id,created_at,expires_at,token_hash=$1 AS current FROM admin_sessions WHERE revoked_at IS NULL AND expires_at>NOW() ORDER BY created_at DESC',[tokenHash]);
 return NextResponse.json({sessions:result.rows},{headers});
}
export async function POST(request:NextRequest){
 const denied=await requireAdmin(request,true);if(denied)return denied;
 const parsed=await readJsonRequest(request,1024);if(parsed.response)return parsed.response;
 const tokenHash=adminTokenHash(request.cookies.get(ADMIN_COOKIE)!.value);
 if(parsed.body.action==='revoke-others')await query('UPDATE admin_sessions SET revoked_at=NOW() WHERE token_hash<>$1 AND revoked_at IS NULL',[tokenHash]);
 else if(typeof parsed.body.id==='string'&&/^[a-f0-9-]{36}$/.test(parsed.body.id))await query('UPDATE admin_sessions SET revoked_at=NOW() WHERE id=$1',[parsed.body.id]);
 else return NextResponse.json({error:'Choose a session to revoke.'},{status:400,headers});
 return NextResponse.json({success:true},{headers});
}
