'use client';
import {useEffect,useState} from 'react';
type Job={id:string;subject:string;total:number;sent:number;failed:number;pending:number};
export default function NewsletterJobs(){
 const [jobs,setJobs]=useState<Job[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function load(){const res=await fetch('/api/admin/newsletter/jobs',{cache:'no-store'});if(!res.ok)throw Error('Delivery status could not be loaded.');setJobs((await res.json()).campaigns);}
 useEffect(()=>{void load().catch(e=>setError(e.message));},[]);
 async function retry(id:string){setBusy(true);try{const res=await fetch('/api/admin/newsletter/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});if(!res.ok)throw Error('Retry could not be scheduled.');await load();}catch(e){setError(e instanceof Error?e.message:'Retry failed.');}finally{setBusy(false);}}
 return <section className="mb-8 border border-white/10 p-6"><div className="flex items-center justify-between gap-4"><h2 className="text-lg font-semibold">Campaign delivery</h2><button className="text-sm underline" onClick={()=>{setError('');void load().catch(e=>setError(e.message));}}>Refresh status</button></div><p className="mt-2 text-sm text-white/50">Saved campaigns resume in the background. SMTP acceptance does not confirm inbox delivery.</p>{error&&<p role="alert">{error}</p>}{!jobs.length?<p className="mt-4 text-sm text-white/50">No saved campaigns yet.</p>:<ul className="mt-4 space-y-4">{jobs.map(job=><li key={job.id} className="border-t border-white/10 pt-4"><strong>{job.subject}</strong><p className="text-sm text-white/60">{job.sent} accepted · {job.pending} waiting · {job.failed} need attention · {job.total} recipients</p>{job.failed>0&&<button disabled={busy} className="mt-2 text-sm underline" onClick={()=>retry(job.id)}>Retry failed recipients</button>}</li>)}</ul>}</section>;
}
