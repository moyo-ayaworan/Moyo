'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { FeedbackReport, FeedbackStatus } from '@/lib/stillboundsFeedback';
import styles from './FeedbackInbox.module.css';
type Report = FeedbackReport & { status: FeedbackStatus; createdAt:string; updatedAt:string };
const statuses = ['new','investigating','fixed','closed'] as const;
export default function FeedbackInbox() {
  const [filter,setFilter] = useState('all'), [page,setPage] = useState(0), [refresh,setRefresh] = useState(0);
  const [reports,setReports] = useState<Report[]>([]), [hasMore,setHasMore] = useState(false), [loading,setLoading] = useState(true);
  const [error,setError] = useState(''), [saving,setSaving] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setReports([]); setHasMore(false);
    fetch(`/api/admin/stillbounds-feedback?status=${filter}&page=${page}`,{cache:'no-store',credentials:'same-origin',signal:controller.signal})
      .then(async response => { const data=await response.json(); if(!response.ok)throw Error(response.status===401?'Your admin session expired. Sign in again.':data.error || 'Could not load feedback.'); return data; })
      .then(data => { if(!controller.signal.aborted) {setReports(data.reports);setHasMore(data.hasMore);} })
      .catch(e => {if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Could not load feedback.');})
      .finally(() => {if(!controller.signal.aborted)setLoading(false);});
    return () => controller.abort();
  },[filter,page,refresh]);
  async function update(id:string,status:FeedbackStatus) {
    setSaving(id);setError('');
    try {
      const response=await fetch('/api/admin/stillbounds-feedback',{method:'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status})});
      const data=await response.json(); if(!response.ok)throw Error(data.error || 'Could not update this report.');
      setRefresh(n=>n+1);
    } catch(e) {setError(e instanceof Error?e.message:'Could not update this report.');}
    finally {setSaving('');}
  }
  return <main className={styles.page}>
    <header><Link href="/admin">Back to admin</Link><p className={styles.eyebrow}>STILLBOUNDS / PRIVATE INBOX</p><h1>App feedback</h1>
      <p>Bug reports and suggestions sent from Stillbounds. This inbox is separate from client book reviews.</p></header>
    <section className={styles.controls} aria-label="Feedback controls"><label>Status<select aria-label="Filter feedback status" value={filter} onChange={e=>{setFilter(e.target.value);setPage(0);}}><option value="all">All reports</option>{statuses.map(status=><option key={status} value={status}>{status[0].toUpperCase()+status.slice(1)}</option>)}</select></label>
      <button disabled={loading} onClick={()=>setRefresh(n=>n+1)}>Refresh inbox</button><span>Page {page+1}</span></section>
    {error && <p role="alert" className={styles.error}>{error} <Link href="/admin/login?next=/admin/stillbounds/feedback">Admin sign-in</Link></p>}
    {loading && <p role="status">Loading feedback…</p>}
    {!loading && !error && !reports.length && <p className={styles.empty}>No reports in this view. Testers can use Home or Help → Send app feedback in Stillbounds.</p>}
    <section aria-label="Feedback reports" className={styles.reports}>{reports.map(report=><article key={report.id}>
      <div className={styles.reportHeader}><div><p className={styles.eyebrow}>{report.kind==='bug'?'BUG REPORT':report.kind==='idea'?'SUGGESTION':'FEEDBACK'} · {new Date(report.createdAt).toLocaleString()}</p><h2>{report.title}</h2></div>
        <label>Status<select aria-label={`Status for ${report.title}`} disabled={!!saving} value={report.status} onChange={e=>void update(report.id,e.target.value as FeedbackStatus)}>{statuses.map(status=><option key={status} value={status}>{status[0].toUpperCase()+status.slice(1)}</option>)}</select></label></div>
      <p className={styles.description}>{report.message}</p>
      {report.steps && <details><summary>Steps to reproduce</summary><p className={styles.description}>{report.steps}</p></details>}
      <dl><div><dt>Reply email · tester provided</dt><dd>{report.replyTo || 'Not provided'}</dd></div>
        <div><dt>System details · optional</dt><dd>{report.diagnostics?`Stillbounds ${report.diagnostics.appVersion} · macOS ${report.diagnostics.osVersion} · ${report.diagnostics.architecture}`:'Not included'}</dd></div>
        <div><dt>Reference</dt><dd>{report.id}</dd></div></dl>
      {saving===report.id && <p role="status">Saving status…</p>}
    </article>)}</section>
    <nav aria-label="Feedback pages" className={styles.controls}><button disabled={!page || loading} onClick={()=>setPage(p=>p-1)}>Previous</button><button disabled={!hasMore || loading} onClick={()=>setPage(p=>p+1)}>Next</button></nav>
    <footer>Reports are private to website administrators. Contact details are supplied by testers and are not verified. Status changes do not send email. No photos, projects or logs are attached.</footer>
  </main>;
}
