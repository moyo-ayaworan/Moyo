'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { analyticsPath } from '@/lib/analyticsPolicy';
export default function AnalyticsTracker(){
 const pathname=usePathname(),last=useRef('');
 useEffect(()=>{
  if(!analyticsPath(pathname)||last.current===pathname||navigator.doNotTrack==='1'||(navigator as Navigator & {globalPrivacyControl?:boolean}).globalPrivacyControl)return;
  const previous=last.current;
  last.current=pathname;
  void fetch('/api/analytics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:crypto.randomUUID(),path:pathname,referrer:previous?window.location.origin+previous:document.referrer}),keepalive:true}).catch(()=>{});
 },[pathname]);return null;
}
