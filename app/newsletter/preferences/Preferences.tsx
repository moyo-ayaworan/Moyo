'use client';
import {useEffect,useState,useRef} from 'react';
import Link from 'next/link';
export default function Preferences(){
 const read=useRef(false);
 const [preference,setPreference]=useState<{action:string;token:string}|null>(null),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 useEffect(()=>{
  if(read.current)return;read.current=true;
  const fragment=new URLSearchParams(window.location.hash.slice(1));
  const action=fragment.has('confirm')?'confirm':'unsubscribe',token=fragment.get(action)||'';
  window.history.replaceState(null,'',window.location.pathname);
  queueMicrotask(()=>{setPreference(/^[a-f0-9]{64}$/.test(token)?{action,token}:null);setReady(true);});
 },[]);
 async function update(){if(!preference||busy)return;setBusy(true);setError('');try{
  const response=await fetch('/api/newsletter/preferences',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(preference)});
  const result=await response.json();if(!response.ok)throw Error(result.error||'Please try again.');setMessage(result.message);
 }catch(e){setError(e instanceof Error?e.message:'Please try again.');}finally{setBusy(false);}}
 return <main className="flex min-h-screen items-center justify-center bg-background px-6 py-24 text-foreground"><section className="w-full max-w-lg space-y-6">
  <h1 className="font-heading text-3xl">{preference?.action==='confirm'?'Confirm your subscription':'Newsletter preferences'}</h1>
  {!ready?<p>Preparing your preferences…</p>:message?<p role="status">{message}</p>:preference?<><p>{preference.action==='confirm'?'Confirm that you would like to receive studio updates.':'Stop receiving updates from the newsletter list linked in your email.'}</p><button disabled={busy} onClick={update} className="min-h-12 border border-foreground px-5 py-3 disabled:opacity-50">{busy?'Saving…':preference.action==='confirm'?'Confirm subscription':'Unsubscribe'}</button></>:<p>Open the complete preference link from your email. Confirmation links expire after 24 hours.</p>}
  {error&&<p role="alert">{error}</p>}<Link href="/" className="block text-sm underline">Return to the website</Link>
 </section></main>;
}
