'use client';
import React,{Suspense,useState} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import Navbar from '@/components/Navbar';
const inputClass='min-w-0 w-full rounded-sm border border-foreground/10 bg-foreground/[0.04] px-4 py-3 text-sm text-foreground placeholder:text-foreground/25 focus:border-accent focus-visible:ring-1 focus-visible:ring-accent outline-none transition-colors';
const buttonClass='w-full bg-accent py-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--on-accent)] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:tracking-[0.4em]';
function AdminLoginForm(){
 const router=useRouter(),params=useSearchParams();
 const [password,setPassword]=useState(''),[code,setCode]=useState(''),[step,setStep]=useState<'password'|'enroll'|'verify'|'recovery'>('password');
 const [setup,setSetup]=useState<{qrCode:string;manualKey:string}|null>(null),[recovery,setRecovery]=useState<string[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const enter=()=>{const next=params.get('next')||'/admin';router.replace(next==='/admin'||next.startsWith('/admin/')?next:'/admin');router.refresh();};
 async function submit(event:React.FormEvent){
  event.preventDefault();setBusy(true);setError('');
  try{
   const response=await fetch('/api/admin/verify',{method:'POST',headers:{'Content-Type':'application/json',...step==='password'?{'x-admin-key':password.trim()}:{}},body:JSON.stringify(step==='password'?{}:{code:code.trim()})});
   const body=await response.json();
   if(!response.ok)throw Error(body.error||'Could not sign in.');
   setPassword('');setCode('');
   if(response.status===202){setStep(body.step);if(body.step==='enroll')setSetup({qrCode:body.qrCode,manualKey:body.manualKey});return;}
   setSetup(null);
   if(Array.isArray(body.recoveryCodes)){setRecovery(body.recoveryCodes);setStep('recovery');return;}
   enter();
  }catch(error){setError(error instanceof Error?error.message:'Could not sign in.');}finally{setBusy(false);}
 }
 function downloadCodes(){const blob=new Blob(['Moyo Studio admin recovery codes\nKeep these private. Each code works once.\n\n'+recovery.join('\n')],{type:'text/plain'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='moyo-admin-recovery-codes.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return <main className="flex min-h-screen flex-col bg-background text-foreground"><Navbar/><section className="flex flex-1 items-center justify-center px-6 pb-8 pt-36 md:pt-52"><form onSubmit={submit} className="w-full max-w-md space-y-6 border border-foreground/10 bg-surface/40 p-8 text-sm backdrop-blur-md">
  <div className="space-y-2 text-center">
   <p className="text-[10px] uppercase tracking-[0.28em] text-accent sm:tracking-[0.5em]">Admin Access</p>
   <h1 className="font-heading text-3xl italic text-foreground">{step==='password'?'Enter admin password':step==='enroll'?'Set up your authenticator':step==='recovery'?'Save your recovery codes':'Verify your sign in'}</h1>
   {step==='password'?<p className="text-sm text-foreground/50">Required before the control panel can load.</p>:null}
  </div>
  {step==='password'?<><label htmlFor="admin-password" className="sr-only">Admin password</label><input id="admin-password" className={inputClass} placeholder="Admin password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></>:null}
  {step==='enroll'&&setup?<><p>Scan this QR code in your authenticator app. Then enter its current six-digit code. Setup expires after five minutes.</p><img src={setup.qrCode} width={240} height={240} alt="Moyo Studio authenticator setup QR code" className="mx-auto rounded bg-white"/><details><summary>Enter a setup key manually</summary><p className="break-all select-all py-3 font-mono">{setup.manualKey}</p><p>Account: Moyo Studio admin · Time-based · 6 digits · 30 seconds.</p></details></>:null}
  {(step==='verify'||step==='enroll')?<label className="block">{step==='enroll'?'Authenticator code':'Authenticator or recovery code'}<input className={inputClass} autoComplete="one-time-code" value={code} onChange={e=>setCode(e.target.value)} maxLength={100} required autoFocus/><span className="mt-2 block text-sm text-foreground/65">Use the current code. A code already used for sign-in cannot be used again.</span></label>:null}
  {step==='recovery'?<><p>Your authenticator is enabled. Save these eight codes somewhere private before continuing. Each replaces an authenticator code once.</p><ul className="space-y-2 overflow-wrap-anywhere break-all font-mono text-sm">{recovery.map(code=><li key={code}>{code}</li>)}</ul><button type="button" onClick={downloadCodes} className="underline">Download recovery codes</button><button type="button" onClick={()=>{setRecovery([]);enter();}} className={buttonClass}>I’ve saved my codes · Continue</button></>:<button disabled={busy} className={buttonClass}>{busy?'Checking…':step==='password'?'Unlock':'Verify'}</button>}
  {error?<p role="alert" className="border border-accent/30 bg-surface p-3 text-center text-sm text-foreground">{error}</p>:null}
  {step!=='password'&&step!=='recovery'?<button type="button" className="text-sm underline" onClick={()=>{setSetup(null);setCode('');setStep('password');setError('');}}>Start sign-in again</button>:null}
 </form></section></main>;
}
export default function AdminLoginPage(){return <Suspense fallback={null}><AdminLoginForm/></Suspense>;}
