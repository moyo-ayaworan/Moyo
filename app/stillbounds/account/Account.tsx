'use client';
import Link from 'next/link';
import { useBrowserLocation } from '@/lib/useBrowserLocation';
import BillingPanel from './BillingPanel';
import MyReviewBooks from './MyReviewBooks';
import { useEffect, useState, type FormEvent } from 'react';
import styles from './account.module.css';
import site from '@/components/mofolio/mofolio.module.css';

const base = '/api/stillbounds/auth';
class AccountError extends Error {
  constructor(message: string, readonly code?: string) { super(message); }
}
async function api(path: string, body?: object) {
  const response = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new AccountError(data.message || data.error_description || 'Please try again.', data.code);
  return data;
}
type User = { name: string; email: string };
type Mode = 'signin' | 'signup' | 'verify' | 'reset' | 'new-password';
export default function Account() {
  const [user, setUser] = useState<User | null>(null), [ready, setReady] = useState(false);
  const href = useBrowserLocation();
  const params = new URLSearchParams(href ? new URL(href).search : '');
  const incomingCode = params.get('user_code') || '';
  const [modeOverride, setMode] = useState<Mode | null>(null);
  const mode = modeOverride ?? (params.get('token') ? 'new-password' : incomingCode || params.get('mode') === 'signup' ? 'signup' : 'signin');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [codeOverride, setCode] = useState<string | null>(null), [verifiedCode, setVerifiedCode] = useState(''), [approved, setApproved] = useState(false);
  const code = codeOverride ?? incomingCode;
  const [desktopFlowOverride, setDesktopFlow] = useState<boolean | null>(null);
  const desktopFlow = desktopFlowOverride ?? Boolean(incomingCode);
  useEffect(() => {
    api('/get-session').then(data => setUser(data?.user || null)).catch(e => setError(e.message)).finally(() => setReady(true));
  }, []);
  async function run(work: () => Promise<void>) { setBusy(true); setError(''); setMessage(''); try { await work(); } catch(e) { setError(e instanceof Error ? e.message : 'Please try again.'); } finally { setBusy(false); } }
  function changeMode(next: Mode) { setMode(next); setError(''); setMessage(''); }
  useEffect(() => {
    if (ready) document.getElementById('account-title')?.focus();
  }, [mode, user?.email, approved, ready]);
  const accountURL = () => location.origin + '/stillbounds/account' + (code ? '?user_code=' + encodeURIComponent(code) : '');
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    void run(async () => {
      const password = String(data.get('password') || '');
      const callbackURL = accountURL();
      if (mode === 'reset') { await api('/request-password-reset', { email, redirectTo: callbackURL }); setMessage('If an account exists for this address, a password-reset link is on its way. Check your inbox and spam folder.'); return; }
      if (mode === 'new-password') { await api('/reset-password', { newPassword: password, token: new URLSearchParams(location.search).get('token') }); history.replaceState({}, '', callbackURL); setMode('signin'); setMessage('Password updated. Sign in to continue.'); return; }
      if (mode === 'signup') { await api('/sign-up/email', { name: String(data.get('name')), email, password, callbackURL }); setMode('verify'); return; }
      try { await api('/sign-in/email', { email, password, callbackURL }); }
      catch (e) { if (e instanceof AccountError && e.code === 'EMAIL_NOT_VERIFIED') { setMode('verify'); return; } throw e; }
      const session = await api('/get-session');
      if (!session?.user) throw new Error('We could not confirm your sign-in. Please try again.');
      setUser(session.user);
    });
  }
  const recovery = mode === 'reset' || mode === 'new-password';
  const step = user ? 3 : mode === 'verify' ? 2 : 1;
  const title = !ready ? 'Preparing your account' : approved ? 'Return to Stillbounds' : user ? desktopFlow ? 'Connect this Mac' : `Welcome, ${user.name}` : mode === 'signup' ? 'Create your account' : mode === 'verify' ? 'Check your inbox' : mode === 'reset' ? 'Reset your password' : mode === 'new-password' ? 'Choose a new password' : 'Welcome back';
  return <div className={site.page}>
    <header className={site.header}><Link href="/stillbounds" className={site.logo}>Stillbounds<span>.</span></Link><Link href="/stillbounds" className={styles.homeLink}>Back to Stillbounds ↗</Link></header>
    <main className={styles.page}><section className={styles.card} aria-labelledby="account-title" aria-busy={busy}>
      <p className={styles.eyebrow}>{desktopFlow ? 'LET’S SET UP STILLBOUNDS ON YOUR MAC' : 'YOUR STILLBOUNDS ACCOUNT'}</p>
      {!recovery && <ol className={styles.progress} aria-label="Account setup progress">{['Account', 'Verify email', 'Connect Mac'].map((label, index) => <li key={label} aria-current={!approved && step === index + 1 ? 'step' : undefined} data-complete={approved || step > index + 1}><span>{approved || step > index + 1 ? '✓' : index + 1}</span>{label}</li>)}</ol>}
      <h1 id="account-title" tabIndex={-1}>{title}</h1>
      {!ready ? <p role="status">Checking whether you’re already signed in…</p> : user ? <>
        {approved ? <div className={styles.nextStep}><span className={styles.successMark} aria-hidden="true">✓</span><p><strong>Your account is connected.</strong></p><p>Switch back to the Stillbounds app on your Mac. It will check activation and take you to your books. If it is still waiting, choose <strong>Activate this Mac</strong> in the app.</p><p className={styles.hint}>You can close this browser tab.</p></div> : <>
          <p className={styles.identity}>Signed in as <strong>{user.email}</strong></p>
          {desktopFlow ? <p>Confirm the code shown in the Stillbounds app to finish connecting your account. Then return to the app to start creating.</p> : <p>Open Stillbounds on your Mac and choose <strong>Continue in browser</strong>. The app will bring you here with a connection code.</p>}
          {(desktopFlow || code) ? <form onSubmit={e => {e.preventDefault(); void run(async () => {const request = await api('/device?user_code=' + encodeURIComponent(code)); if(request.client_id !== 'stillbounds-desktop' || request.status !== 'pending') throw new Error('This code has expired or is unavailable. Return to Stillbounds and start the connection again.'); setVerifiedCode(code);});}}>
            {!verifiedCode ? <><label>Code shown in Stillbounds<input value={code} onChange={e => {setCode(e.target.value); setVerifiedCode('');}} maxLength={32} required autoComplete="off" spellCheck={false} className={styles.codeInput} /></label><p className={styles.hint}>Only continue if you started this request in the app on your own Mac.</p><button disabled={busy}>{busy ? 'Checking code…' : 'Check connection code →'}</button></> : <>
              <div className={styles.codeReview}><span>Does this match the code in your app?</span><strong>{verifiedCode}</strong><span>Stillbounds desktop · Your Mac</span></div>
              <button type="button" disabled={busy} onClick={() => void run(async () => {await api('/device/approve', {userCode: verifiedCode}); setApproved(true);})}>{busy ? 'Connecting…' : 'Yes, connect this Mac →'}</button>
              <button type="button" className={styles.textButton} disabled={busy} onClick={() => void run(async () => {await api('/device/deny', {userCode: verifiedCode}); setVerifiedCode(''); setCode(''); setDesktopFlow(false); setMessage('Connection declined. Start again from the Stillbounds app when you’re ready.');})}>This isn’t my request</button>
            </>}
          </form> : <details className={styles.details}><summary>I already have a connection code</summary><form onSubmit={e => {e.preventDefault(); setDesktopFlow(true);}}><label>Code from the app<input value={code} onChange={e => setCode(e.target.value)} maxLength={32} required autoComplete="off" /></label><button>Continue →</button></form></details>}
          {!desktopFlow && <p className={styles.hint}>Your free trial starts when you activate the app—not when you create your account.</p>}
        </>}
        <MyReviewBooks />
        <details className={styles.details}><summary>Licence, laptops & account settings</summary><BillingPanel /><p>Your originals and editable projects stay on your Mac. Published review previews are stored online until they expire or you delete them.</p><div className={styles.actions}><button type="button" className={styles.secondary} disabled={busy} onClick={() => void run(async () => {await api('/revoke-other-sessions', {}); setMessage('Other account sessions have been signed out.');})}>Sign out other sessions</button><button type="button" className={styles.secondary} disabled={busy} onClick={() => void run(async () => {await api('/sign-out', {}); setUser(null); setVerifiedCode(''); setApproved(false); setMode('signin');})}>Sign out</button></div></details>
      </> : mode === 'verify' ? <>
        <p>We sent a verification link to <strong>{email}</strong>.</p>
        <div className={styles.nextStep}><h2>Next: verify your email</h2><p>Open the email from Stillbounds and choose the verification link. It will bring you back here to {desktopFlow ? 'connect your Mac' : 'continue setting up your account'}.</p><p className={styles.hint}>Can’t find it? Check your spam folder. Keep the Stillbounds app open while you finish.</p></div>
        <button className={styles.fullWidth} disabled={busy} onClick={() => void run(async () => {const session = await api('/get-session'); if(session?.user) setUser(session.user); else {setMode('signin'); setMessage('If you’ve verified your email, sign in below to continue.');}})}>{busy ? 'Checking verification…' : 'I’ve verified my email →'}</button>
        <button className={styles.textButton} disabled={busy} onClick={() => changeMode('signup')}>Use a different email address</button>
      </> : <>
        <p>{mode === 'signup' ? 'One account for the website and your Mac. First, create your account. We’ll then help you verify your email and connect the app.' : mode === 'reset' ? 'Enter your account email and we’ll send a password-reset link.' : mode === 'new-password' ? 'Choose a new password of at least 12 characters.' : desktopFlow ? 'Sign in to your existing account, then connect this Mac.' : 'Sign in to connect your Mac or manage your account.'}</p>
        <form onSubmit={submit}>
          {mode === 'signup' && <label>Your name<input name="name" required maxLength={100} autoComplete="name" /></label>}
          {mode !== 'new-password' && <label>Email address<input name="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required maxLength={254} autoComplete="email" /></label>}
          {mode !== 'reset' && <div><label>Password<input name="password" type="password" required minLength={mode === 'signin' ? 1 : 12} maxLength={128} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} aria-describedby={mode !== 'signin' ? 'password-help' : undefined} /></label>{mode !== 'signin' && <span id="password-help" className={styles.hint}>At least 12 characters. A few memorable words work well.</span>}</div>}
          {mode === 'signup' && <label className={styles.consent}><input type="checkbox" required /><span>I agree to the <Link href="/stillbounds/terms" target="_blank" rel="noopener noreferrer">terms</Link> and <Link href="/stillbounds/privacy" target="_blank" rel="noopener noreferrer">privacy policy</Link>.</span></label>}
          <button disabled={busy}>{busy ? 'Please wait…' : mode === 'signup' ? 'Create account & verify email →' : mode === 'reset' ? 'Send reset link' : mode === 'new-password' ? 'Save password' : desktopFlow ? 'Sign in & continue →' : 'Sign in →'}</button>
        </form>
        <div className={styles.modeLinks}>{recovery ? <button className={styles.textButton} disabled={busy} onClick={() => changeMode('signin')}>Back to sign in</button> : <><p>{mode === 'signup' ? 'Already have an account?' : 'New to Stillbounds?'} <button className={styles.textButton} disabled={busy} onClick={() => changeMode(mode === 'signup' ? 'signin' : 'signup')}>{mode === 'signup' ? 'Sign in' : 'Create an account'}</button></p>{mode === 'signin' && <button className={styles.textButton} disabled={busy} onClick={() => changeMode('reset')}>Forgot password?</button>}</>}</div>
        {mode === 'signup' && <p className={styles.trialNote}>30 days free from your first activation. No card required. No automatic charge.</p>}
      </>}
      {message && <p role="status" className={styles.feedback}>{message}</p>}{error && <p role="alert" className={styles.error}>{error}</p>}
    </section><p className={styles.privacyNote}>Original photographs and editable projects stay on your Mac. Review previews upload only when you publish.</p></main>
    <footer className={site.footer}><Link href="/stillbounds" className={site.logo}>Stillbounds<span>.</span></Link><span>by Moyo Ayaworan.</span><div><Link href="/stillbounds/terms">Terms</Link><Link href="/stillbounds/privacy">Privacy</Link></div></footer>
  </div>;
}
