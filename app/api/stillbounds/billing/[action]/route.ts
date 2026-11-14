import {isDisplayCurrency} from '@/lib/regionalPricing';
import {NextRequest} from 'next/server';
import {stillboundsAuth} from '@/lib/stillboundsAuth';
import {rateLimit} from '@/lib/rateLimit';
import {billingService,validateDevice} from '@/lib/stillbounds/billing-service';
import {BillingError} from '@/lib/stillbounds/billing-store';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'};
async function boundedBody(request:Request){const reader=request.body?.getReader();if(!reader)return '';const chunks:Uint8Array[]=[];let size=0;for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536){await reader.cancel();throw new BillingError('BODY_TOO_LARGE',413,'Request is too large.');}chunks.push(value);}return Buffer.concat(chunks).toString('utf8');}
async function handle(request:NextRequest,context:{params:Promise<{action:string}>}){
 try{
  const {action}=await context.params;
  if(!['offer','status','challenge','activate','checkout','verify','deactivate','webhook'].includes(action))return Response.json({error:'Not found.'},{status:404,headers});
  const service=billingService(),country=request.headers.get('x-vercel-ip-country')||'';
  if(action==='webhook'){if(request.method!=='POST')return new Response(null,{status:405,headers});await service.webhook(await boundedBody(request),request.headers.get('x-paystack-signature')||'',request.headers.get('paystack-signature')||'');return Response.json({received:true},{headers});}
  if(action==='offer'){if(request.method!=='GET')return new Response(null,{status:405,headers});return Response.json(service.offer(country),{headers});}
  if(request.method!=='POST'&&!(request.method==='GET'&&action==='status'))return new Response(null,{status:405,headers});
  const authHeaders=new Headers(request.headers);const authorization=request.headers.get('authorization');
  if(authorization){if(!/^Bearer [A-Za-z0-9._~-]{16,4096}$/.test(authorization))throw new BillingError('SIGN_IN_REQUIRED',401,'Sign in to your Stillbounds account.');authHeaders.delete('cookie');}
  else if(request.method==='POST'&&request.headers.get('origin')!==service.config.origin)throw new BillingError('INVALID_ORIGIN',403,'Open this page from the Stillbounds website.');
  const session=await stillboundsAuth().api.getSession({headers:authHeaders,query:{disableCookieCache:true}});
  if(!session?.user)throw new BillingError('SIGN_IN_REQUIRED',401,'Sign in to your Stillbounds account.');
  if(!session.user.emailVerified)throw new BillingError('VERIFY_EMAIL',403,'Verify your email before starting your free trial.');
  const limited=await rateLimit(request,'stillbounds-billing-'+action,action==='checkout'?6:90,900);if(limited)return limited;
  const raw=request.method==='POST'?await boundedBody(request):'{}';let body:Record<string,unknown>;try{body=JSON.parse(raw||'{}');if(!body||typeof body!=='object'||Array.isArray(body))throw Error();}catch{throw new BillingError('INVALID_BODY',400,'Invalid request.');}
  const user={id:session.user.id,email:session.user.email,emailVerified:session.user.emailVerified};
  let result:unknown;
  if(action==='status')result=await service.status(user,country);
  else if(action==='checkout'){const currency=body.displayCurrency??'NGN';if(!isDisplayCurrency(currency))throw new BillingError('INVALID_CURRENCY',400,'Choose a valid currency.');result=await service.checkout(user,country,currency,typeof body.expectedAmount==='number'?body.expectedAmount:undefined,typeof body.resumeReference==='string'?body.resumeReference:undefined,typeof body.resumeAmount==='number'?body.resumeAmount:undefined);}
  else if(action==='challenge'){service.requireEnabled();result=await service.store.challenge(service.config.mode,user.id,validateDevice(body));}
  else if(action==='activate'){if(typeof body.challengeId!=='string'||!/^[-a-f0-9]{36}$/.test(body.challengeId)||typeof body.signature!=='string'||!/^[A-Za-z0-9_-]{86}$/.test(body.signature))throw new BillingError('INVALID_DEVICE',400,'Invalid activation.');result=await service.activate(user,body.challengeId,body.signature,country);}
  else if(action==='verify'){if(typeof body.reference!=='string')throw new BillingError('INVALID_REFERENCE',400,'Invalid payment reference.');result=await service.verify(user,body.reference,country);}
  else if(action==='deactivate'){service.requireEnabled();if(typeof body.activationId!=='string'||!/^[-a-f0-9]{36}$/.test(body.activationId))throw new BillingError('INVALID_DEVICE',400,'Choose a laptop to deactivate.');await service.store.deactivate(service.config.mode,user.id,body.activationId);result=await service.status(user,country);}
  return Response.json(result,{headers});
 }catch(error){if(!(error instanceof BillingError)||error.status>=500){const {recordOperationalFailure}=await import('@/lib/operations');await recordOperationalFailure('stillbounds_error');}if(error instanceof BillingError)return Response.json({error:error.message,code:error.code},{status:error.status,headers});return Response.json({error:'Activation is temporarily unavailable. Your existing books are safe.',code:'SERVICE_UNAVAILABLE'},{status:503,headers});}
}
export {handle as GET,handle as POST};
