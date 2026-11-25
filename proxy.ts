import {randomBytes} from 'node:crypto';
import {NextResponse,type NextRequest} from 'next/server';
import {ADMIN_COOKIE,hasAdminSession} from '@/lib/auth';
import {privateCsp} from '@/lib/privateCsp';
import {isPrivatePage} from '@/lib/privatePaths';
export function proxy(request:NextRequest){
 const path=request.nextUrl.pathname;
 if(!isPrivatePage(path))return NextResponse.next();
 const nonce=randomBytes(18).toString('base64'),policy=privateCsp(nonce,process.env.NODE_ENV==='development');
 const forwarded=new Headers(request.headers);forwarded.set('x-nonce',nonce);forwarded.set('Content-Security-Policy',policy);
 let response:NextResponse;
 // This is only a routing hint; every admin API also checks the live session store.
 if(path.startsWith('/admin')&&path!=='/admin/login'&&!hasAdminSession(request.cookies.get(ADMIN_COOKIE)?.value)){
  const login=request.nextUrl.clone();login.pathname='/admin/login';login.search='';login.searchParams.set('next',path);response=NextResponse.redirect(login);
 }else response=NextResponse.next({request:{headers:forwarded}});
 response.headers.set('Content-Security-Policy',policy);response.headers.set('Cache-Control','private, no-store');response.headers.set('Referrer-Policy','no-referrer');response.headers.set('X-Robots-Tag','noindex, nofollow, noarchive');
 return response;
}
export const config={matcher:['/admin/:path*','/client/:path*','/collector/:path*','/payments/:path*','/stillbounds/account/:path*','/stillbounds/review/:path*','/mofolio/account/:path*','/mofolio/review/:path*','/photography/shop/payment','/art/shop/payment','/newsletter/preferences']};
