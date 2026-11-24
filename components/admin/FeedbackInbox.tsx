'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Inbox, LockKeyhole, RefreshCw, Bug, Lightbulb, MessageSquare, ChevronDown } from 'lucide-react';
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
    <div className={styles.inner}>
      <header className={styles.topbar}>
        <Link href="/admin/stillbounds" className={styles.brand}>Stillbounds<span aria-hidden="true">.</span><small>ADMIN</small></Link>
        <Link href="/admin" className={styles.back}><ArrowLeft size={15} aria-hidden="true" />Back to admin</Link>
      </header>
      <div className={styles.heading}>
        <div><h1>App feedback</h1><p>Bug reports and suggestions from your testers.</p></div>
        <span className={styles.private}><LockKeyhole size={13} aria-hidden="true" />Private inbox</span>
      </div>
      <section className={styles.inbox} aria-label="App feedback inbox">
        <div className={styles.toolbar}>
          <label className={styles.filter}>Status<div className={styles.selectWrap}><select aria-label="Filter feedback status" value={filter} onChange={e=>{setFilter(e.target.value);setPage(0);}}><option value="all">All reports</option>{statuses.map(status=><option key={status} value={status}>{status[0].toUpperCase()+status.slice(1)}</option>)}</select><ChevronDown size={14} aria-hidden="true" /></div></label>
          <div className={styles.toolbarEnd}>
            {!loading && !error && <span className={styles.resultCount}>{reports.length}{hasMore?' +':''} {reports.length===1?'report':'reports'}{page>0?` · Page ${page+1}`:''}</span>}
            <button className={styles.refresh} disabled={loading} onClick={()=>setRefresh(n=>n+1)}><RefreshCw size={15} aria-hidden="true" className={loading?styles.spinning:undefined} />Refresh inbox</button>
          </div>
        </div>
        {error && <div role="alert" className={styles.error}><strong>Unable to load feedback</strong><p>{error}</p><Link href="/admin/login?next=/admin/stillbounds/feedback">Admin sign-in</Link></div>}
        {loading && <div className={styles.empty} role="status"><div className={styles.emptyIcon}><RefreshCw size={24} className={styles.spinning} aria-hidden="true" /></div><h2>Loading feedback…</h2><p>Fetching the latest reports.</p></div>}
        {!loading && !error && !reports.length && <div className={styles.empty}>
          <div className={styles.emptyIcon}><Inbox size={27} strokeWidth={1.5} aria-hidden="true" /></div>
          <h2>{filter==='all'?'No feedback yet':`No ${filter} reports`}</h2>
          <p>No reports in this view. New feedback will appear here<br className={styles.desktopBreak} /> when testers send it from Stillbounds.</p>
          <span className={styles.hint}>In the app: <strong>Help → Send app feedback</strong></span>
        </div>}
        {!!reports.length && <section aria-label="Feedback reports" className={styles.reports}>{reports.map(report=>{
          const Icon=report.kind==='bug'?Bug:report.kind==='idea'?Lightbulb:MessageSquare;
          return <article key={report.id}>
            <div className={styles.reportHeader}>
              <div className={styles.reportHeading}><div className={styles.reportMeta}><span className={styles.kind}><Icon size={13} aria-hidden="true" />{report.kind==='bug'?'Bug report':report.kind==='idea'?'Suggestion':'Feedback'}</span><time dateTime={report.createdAt}>{new Date(report.createdAt).toLocaleString()}</time></div><h2>{report.title}</h2></div>
              <label className={styles.statusLabel}><span className={styles.srOnly}>Status</span><div className={styles.selectWrap}><select aria-label={`Status for ${report.title}`} disabled={!!saving} value={report.status} onChange={e=>void update(report.id,e.target.value as FeedbackStatus)}>{statuses.map(status=><option key={status} value={status}>{status[0].toUpperCase()+status.slice(1)}</option>)}</select><ChevronDown size={14} aria-hidden="true" /></div></label>
            </div>
            <p className={styles.description}>{report.message}</p>
            {report.steps && <details className={styles.steps}><summary>Steps to reproduce</summary><p className={styles.description}>{report.steps}</p></details>}
            <dl className={styles.metadata}>
              <div><dt>Reply email · unverified</dt><dd>{report.replyTo || 'Not provided'}</dd></div>
              <div><dt>App & system</dt><dd>{report.diagnostics?`v${report.diagnostics.appVersion} · macOS ${report.diagnostics.osVersion} · ${report.diagnostics.architecture}`:'Not included'}</dd></div>
              <div><dt>Reference</dt><dd className={styles.reference}>{report.id}</dd></div>
            </dl>
            {saving===report.id && <p role="status" className={styles.saving}>Saving status…</p>}
          </article>;
        })}</section>}
        {(page>0 || hasMore) && <nav aria-label="Feedback pages" className={styles.pagination}><span>Page {page+1}</span><div><button disabled={!page || loading} onClick={()=>setPage(p=>p-1)}>Previous</button><button disabled={!hasMore || loading} onClick={()=>setPage(p=>p+1)}>Next</button></div></nav>}
      </section>
      <footer className={styles.footer}><p><LockKeyhole size={13} aria-hidden="true" />Only website administrators can view these reports.</p><details><summary>About submitted reports</summary><p>Reply emails are supplied by testers and are not verified. Status changes do not send email. No photos, projects or logs are attached.</p></details></footer>
    </div>
  </main>;
}
