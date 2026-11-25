'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
type Session={id:string;created_at:string;expires_at:string;current:boolean};
export default function Security(){
 const [sessions,setSessions]=useState<Session[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function load(){const res=await fetch('/api/admin/sessions',{cache:'no-store'});if(res.status===401){location.assign('/admin/login?next=/admin/security');return;}if(!res.ok)throw Error('Sessions could not be loaded.');setSessions((await res.json()).sessions);}
 useEffect(()=>{load().catch(e=>setError(e.message));},[]);
 async function revoke(body:{action?:string;id?:string}){setBusy(true);setError('');try{const res=await fetch('/api/admin/sessions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!res.ok)throw Error('Could not revoke the session.');await load();}catch(e){setError(e instanceof Error?e.message:'Could not revoke session.');}finally{setBusy(false);}}
 return <main className="mx-auto max-w-3xl px-6 py-16 text-foreground"><Link href="/admin" className="underline">Back to admin</Link><h1 className="mt-7 font-body text-3xl font-semibold">Admin sessions</h1><p className="my-4">Your password and authenticator protect new sign-ins. Revoking a session blocks its next API request.</p><button className="rounded bg-accent px-4 py-3 font-semibold text-white" disabled={busy} onClick={()=>revoke({action:'revoke-others'})}>Sign out other sessions</button>{error?<p role="alert" className="my-4 text-red-500">{error}</p>:null}<ul className="mt-6 space-y-4">{sessions.map(session=><li key={session.id} className="rounded border border-foreground/15 p-5"><strong>{session.current?'Current session':'Admin session'}</strong><p>Signed in {new Date(session.created_at).toLocaleString()}</p><p>Expires {new Date(session.expires_at).toLocaleString()}</p>{!session.current?<button disabled={busy} className="mt-3 underline" onClick={()=>revoke({id:session.id})}>Revoke session</button>:null}</li>)}</ul></main>;
}
