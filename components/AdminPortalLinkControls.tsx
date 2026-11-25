'use client';
import {useState} from 'react';
type LinkState={manage_token:string;portal_expires_at:string;portal_revoked_at:string|null};
export default function AdminPortalLinkControls({kind,id,expires,revoked,onChange}:{kind:'booking'|'collector';id:number;expires?:string;revoked?:string|null;onChange:(value:LinkState)=>void}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function change(action:'renew'|'revoke'){
  if(!confirm(action==='renew'?'Replace this private link? Existing links will stop working.':'Revoke this private link? Customer access through it will stop.'))return;
  setBusy(true);setMessage('');try{const result=await fetch('/api/admin/portal-links',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,id,action})});const body=await result.json();if(!result.ok)throw Error(body.error||'Could not update link.');onChange(body.link);setMessage(action==='renew'?'New link ready. Copy and share it with the client.':'Private link revoked.');}catch(error){setMessage(error instanceof Error?error.message:'Could not update link.');}finally{setBusy(false);}
 }
 return <div className="space-y-2 text-sm"><p>{revoked?'Private link revoked':expires?'Link expires '+new Date(expires).toLocaleDateString():'Private links expire after 180 days.'}</p><div className="flex flex-wrap gap-4"><button type="button" className="underline" disabled={busy} onClick={()=>change('renew')}>Replace private link</button><button type="button" className="underline" disabled={busy||Boolean(revoked)} onClick={()=>change('revoke')}>Revoke link</button></div>{message?<p role="status">{message}</p>:null}</div>;
}
