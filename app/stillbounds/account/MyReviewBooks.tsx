'use client';
import {useEffect,useState} from 'react';
import { useBrowserLocation } from '@/lib/useBrowserLocation';
import styles from './account.module.css';
type Comment={id:string;spreadId:string;text:string;resolved:boolean;pin?:{x:number;y:number}|null};
type Review={id:string;title:string;version:number;expiresAt:number;decision:string;state:string;url:string;spreads:{id:string}[];comments:Comment[]};
const base='/api/stillbounds/reviews';
async function request(path:string,method='GET',body?:object) {
  const response=await fetch(base+path,{method,credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
  const data=await response.json();
  if(!response.ok)throw Error(data.error||'Reviews could not be loaded.');
  return data;
}
export default function MyReviewBooks() {
  const [reviews,setReviews]=useState<Review[]>([]),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[codeOverride,setCode]=useState<string|null>(null),[confirmed,setConfirmed]=useState(false),[deleting,setDeleting]=useState('');
  const href=useBrowserLocation();
  const siteOrigin=href?new URL(href).origin:'';
  const code=codeOverride??(href?new URL(href).searchParams.get('review_code')||'':'');
  async function refresh(){const data=await request('/versions');if(!Array.isArray(data))throw Error('Invalid review response.');setReviews(data);}
  async function run(action:()=>Promise<void>){setBusy(true);setError('');setMessage('');try{await action();}catch(e){setError(e instanceof Error?e.message:'Please try again.');}finally{setBusy(false);setReady(true);}}
  useEffect(()=>{let active=true;request('/versions').then(data=>{if(active){if(!Array.isArray(data))throw Error('Invalid review response.');setReviews(data);}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setReady(true);});return()=>{active=false;};},[]);
  return <section id="reviews" className={styles.reviewBooks} aria-labelledby="my-review-books-title">
    <h2 id="my-review-books-title">My review books</h2>
    <p>Publish from Stillbounds on your Mac, then manage private client links and feedback here. Your original photographs and editable projects stay on your Mac.</p>
    <p className={styles.hint}>Up to 10 active reviews and 50 MiB of previews per account, with expiry after the period chosen when publishing. Each upload contains compressed review pages. Capacity is limited during this beta.</p>
    <button type="button" className={styles.secondary} disabled={busy} onClick={()=>void run(refresh)}>Refresh review books</button>
    {!ready?<p role="status">Loading your review books…</p>:!reviews.length?<p>You haven’t published any review books yet.</p>:reviews.map(review=><article className={styles.reviewBook} key={review.id}>
      <h3>{review.title}</h3><p>Version {review.version} · {review.state==='draft'?'Upload unfinished':review.state==='revoked'?'Link revoked':review.decision==='approved'?'Client approved':review.decision==='changes'?'Changes requested':'Awaiting feedback'}<br/>Expires {new Date(review.expiresAt).toLocaleDateString()} · {review.spreads.length} review surfaces</p>
      {review.state==='published'&&<div className={styles.actions}><a href={review.url} target="_blank" rel="noopener noreferrer">Open private review</a><button type="button" disabled={busy} className={styles.secondary} onClick={()=>void run(async()=>{await navigator.clipboard.writeText(review.url);setMessage('Private review link copied. Share it only with your client.');})}>Copy client link</button></div>}
      {!!review.comments.length&&<details><summary>{review.comments.length} client comments</summary>{review.comments.map(comment=><div className={styles.reviewComment} key={comment.id}><p>{comment.text}</p><small>{comment.resolved?'Resolved':'Unresolved'}{comment.pin?` · Pin at ${Math.round(comment.pin.x*100)}% across, ${Math.round(comment.pin.y*100)}% down`:''} · Spread {Math.max(1,review.spreads.findIndex(s=>s.id===comment.spreadId)+1)}</small>{!comment.resolved&&<button type="button" disabled={busy} className={styles.secondary} onClick={()=>void run(async()=>{await request(`/versions/${review.id}/comments/${comment.id}/resolve`,'POST',{});await refresh();})}>Mark resolved</button>}</div>)}</details>}
      {deleting===review.id?<div role="group" aria-label="Confirm review deletion"><p>Delete this review, its preview pages and feedback? Its client link will stop working. Your local book stays on your Mac.</p><div className={styles.actions}><button type="button" disabled={busy} onClick={()=>void run(async()=>{await request(`/versions/${review.id}`,'DELETE');setDeleting('');await refresh();setMessage('Review deleted and client access removed.');})}>Delete permanently</button><button type="button" disabled={busy} className={styles.secondary} onClick={()=>setDeleting('')}>Keep review</button></div></div>:<button type="button" disabled={busy} className={styles.secondary} onClick={()=>setDeleting(review.id)}>Delete review</button>}
    </article>)}
    <details open={!!code} className={styles.details}><summary>Connect an existing app for review publishing</summary><p>In older Stillbounds versions, open Share for review, enter <strong>{siteOrigin}</strong> and choose Connect website. Approve its review code here, then choose Finish connecting in the app.</p><form onSubmit={event=>{event.preventDefault();void run(async()=>{await request('/pair','POST',{userCode:code,confirm:confirmed});setMessage('Review publishing connected to your account. Return to Stillbounds and choose Finish connecting.');setCode('');setConfirmed(false);});}}><label>Review connection code<input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} maxLength={10} minLength={10} pattern="[A-F0-9]{10}" required autoComplete="off"/></label><label className={styles.consent}><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} required/>I started this review connection on my own Mac.</label><button disabled={busy||!confirmed}>Approve review connection</button></form><button type="button" disabled={busy} className={styles.secondary} onClick={()=>void run(async()=>{await request('/connections','DELETE');setMessage('Previously paired review devices disconnected. Existing client links are unchanged.');})}>Disconnect paired review devices</button></details>
    {message&&<p className={styles.feedback} role="status">{message}</p>}{error&&<p className={styles.error} role="alert">{error}</p>}
  </section>;
}
