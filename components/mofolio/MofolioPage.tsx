'use client';

import { useState, type FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AlbumAssembly, BetaInvitation, BookReader, CompositionPlayground, EditorShowcase, MotionTitle, Reveal, useMofolioMotionReduction } from './MofolioExperience';
import { ArrowRight, ArrowUpRight, BookOpen, Check, Laptop, Layers, LockKeyhole, Mail, Palette, Type } from 'lucide-react';
import styles from './mofolio.module.css';

const features = [
  {icon:BookOpen,title:'A starting point, already arranged.',text:'Choose your photographs and book settings. Build a draft, then make the composition your own.'},
  {icon:Layers,title:'Give every spread its own rhythm.',text:'Mix layouts in the same book. Adjust page margins, spacing and the balance between leading images and smaller details.'},
  {icon:Type,title:'Make the words part of the design.',text:'Add text and captions with bundled fonts, alignment, spacing and reusable text styles.'},
  {icon:Palette,title:'Finish it your way.',text:'Colour borders, paper texture, backgrounds, overlays and double exposure. Keep each adjustment editable.'},
];

function BetaForm() {
  const [state,setState] = useState<'idle'|'sending'|'success'|'error'>('idle');
  const [message,setMessage] = useState('');
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget, data = new FormData(form);
    setState('sending'); setMessage('');
    try {
      const response = await fetch('/api/mofolio/beta',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:data.get('email'),termsAccepted:data.get('termsAccepted')==='on',marketingConsent:data.get('marketingConsent')==='on',website:data.get('website')})});
      const result = await response.json();
      if(!response.ok) throw new Error(result.error || 'We could not save your request. Please try again.');
      setState('success'); setMessage(result.alreadyRequested ? 'You’re already on the list. Your existing preferences are unchanged; email us to change them.' : 'You’re on the list. We’ll email you when a beta place is available.'); form.reset();
    } catch(error) {setState('error');setMessage(error instanceof Error ? error.message : 'Please try again.');}
  }
  return <form className={styles.form} onSubmit={submit} aria-label="Request Stillbounds beta access">
    <label htmlFor="mofolio-email">Your email address</label>
    <div className={styles.emailRow}><input id="mofolio-email" name="email" type="email" required maxLength={254} autoComplete="email" placeholder="you@yourstudio.com" disabled={state==='sending'} /><button className={styles.primary} type="submit" disabled={state==='sending'}>{state==='sending' ? 'Saving your request…' : 'Request beta access'}<ArrowRight size={18} aria-hidden="true" /></button></div>
    <div className={styles.honeypot} aria-hidden="true"><label>Leave this empty<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    <p className={styles.formNotice}>We’ll use your email to manage your beta-access request. <Link href="/mofolio/privacy">Read our Privacy Policy</Link>.</p>
    <label className={styles.consent}><input name="termsAccepted" type="checkbox" required disabled={state==='sending'} /> <span>I agree to the <Link href="/mofolio/terms">Stillbounds beta terms</Link>.</span></label>
    <label className={styles.consent}><input name="marketingConsent" type="checkbox" disabled={state==='sending'} /> <span>Also email me Stillbounds news and product updates (optional). I can withdraw this choice at any time.</span></label>
    <p className={styles.formNotice}>Your address is kept on a separate Stillbounds list. <a href="mailto:ijabikenm@gmail.com?subject=Stillbounds%20privacy">Withdraw a request or marketing consent</a></p>
    <p role={state==='error' ? 'alert' : 'status'} aria-live="polite" className={styles.status}>{message}</p>
  </form>;
}

export default function MofolioPage() {
  const reduced = useMofolioMotionReduction();
  return <div className={styles.page}>
    <header className={styles.header}>
      <Link href="/mofolio" aria-label="Stillbounds home" className={styles.logo}>Stillbounds<span>.</span></Link>
      <nav aria-label="Stillbounds navigation"><a href="#experience">Play with layouts</a><a href="#inside">Inside the app</a><a href="#questions">Questions</a></nav>
      <a href="#beta" className={styles.headerCta}>Request beta access <ArrowUpRight size={16} aria-hidden="true" /></a>
    </header>
    <main>
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.heroTop}><span className={styles.eyebrow}><span className={styles.dot} /> Intelligent photobook design · Private beta</span><Link href="/photography" className={styles.studioLink}>by Moyo Ayaworan <ArrowUpRight size={15} aria-hidden="true" /></Link></div>
        <motion.div initial={false} animate={reduced ? {opacity:1} : {opacity:[0.6,1],y:[18,0]}} transition={{duration:0.8,ease:[0.22,1,0.36,1]}} className={styles.heroCopy}>
          <MotionTitle />
          <div className={styles.heroAside}><p>Turn a folder of photographs into a book worth keeping. Start with an arranged draft. Shuffle the layouts. Make every spread your own.</p><div className={styles.heroActions}><a href="#beta" className={styles.primary}>Request beta access <ArrowRight size={18} aria-hidden="true" /></a><a href="#experience" className={styles.secondary}>Play with a spread <ArrowRight size={15} aria-hidden="true" /></a></div><span className={styles.small}>Built for Apple Silicon Macs.</span></div>
        </motion.div>
        <AlbumAssembly />
        <div className={styles.trustStrip}><span><Laptop size={17} aria-hidden="true" /> Local editing</span><span><LockKeyhole size={17} aria-hidden="true" /> Originals stay untouched</span><span><Check size={17} aria-hidden="true" /> Your composition, your call</span></div>
      </section>
      <section className={styles.intro}>
        <Reveal><span className={styles.eyebrow}>The photograph comes first</span>
        <h2>Less arranging.<br /><em>More creating.</em></h2>
        <p>Stillbounds gives you a draft to work from and space to make decisions. Let a portrait lead. Bring the little details together. Make a book that feels considered, from its first spread to its last.</p></Reveal>
      </section>
      <CompositionPlayground />
      <section className={styles.featureGrid} aria-label="Stillbounds features">{features.map(({icon:Icon,title,text},i)=><Reveal key={title} delay={i * 0.1}><article><div className={styles.featureTop}><Icon size={24} aria-hidden="true" /><span>0{i+1}</span></div><h3>{title}</h3><p>{text}</p></article></Reveal>)}</section>
      <section className={styles.editorSection} id="inside">
        <Reveal className={styles.sectionHeading}><div><span className={styles.eyebrow}>Inside Stillbounds</span><h2>A book at the centre.<br /><em>Tools where you need them.</em></h2></div><p>Photos. Story. Design. Review.<br />Move through a clear workspace, with photo tools that appear when you select an image.</p></Reveal>
        <EditorShowcase><Image src="/mofolio/editor.webp" width={1600} height={990} sizes="90vw" alt="Actual Stillbounds desktop editor showing the book canvas, photo tools and spread navigation" /></EditorShowcase>
        <p className={styles.caption}>Actual app screen · Sample project · Desktop beta</p>
        <div className={styles.steps}>{[['01','Bring your photographs','Import a folder and choose the book’s purpose, size and starting style.'],['02','Find the flow','Assemble a draft. Try compositions, refine crops and add your finishing touches.'],['03','Keep and share the work','Save your project, take a quick snapshot or export a PDF for review.']].map(([n,title,text])=><article key={n}><span>{n}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>
      <BookReader />
      <section className={styles.localSection}><Reveal><LockKeyhole size={27} aria-hidden="true" /><span className={styles.eyebrow}>Your Mac. Your photographs.</span><h2>Keep the originals.<br /><em>Explore the possibilities.</em></h2></Reveal><Reveal delay={0.12}><p>Local editing works offline. Frames, textures and photo effects are saved as editable settings; your source photographs stay unchanged.</p><p>Client links and any online services have their own connectivity requirements. This beta does not include a printing or delivery service.</p></Reveal></section>
      <section className={styles.faq} id="questions"><div><span className={styles.eyebrow}>Before you begin</span><h2>A few good<br /><em>questions.</em></h2></div><div>{[
        ['Which computers does it support?','The current beta is built for Apple Silicon Macs. Windows and Intel Mac releases are not available. Exact supported macOS versions will be confirmed with beta installation testing.'],
        ['Is the beta available to download?','We’re inviting a small group of photographers first. Request access below. We’ll email you with availability and installation instructions; signing and notarization are part of release preparation.'],
        ['How big is the app?','The current installer is approximately 2.9 GB, with about 4.3 GB for installed files. Your photo library, project previews and exports need additional space.'],
        ['Can I still design by hand?','Yes. Change layouts, spacing, crops, backgrounds and text. Lock a spread or keep a composition when you want automatic arrangement to leave it alone.'],
        ['What about AI and printing?','Local analysis and automated layout tools provide suggestions that need your review. We do not promise perfect selection, semantic storytelling or print certification. Review exported files against your chosen lab’s requirements.'],
        ['How much will it cost?','Pricing has not been announced. The beta is for gathering feedback on real photography workflows before a wider release.'],
      ].map(([q,a])=><details key={q}><summary>{q}<span aria-hidden="true">+</span></summary><p>{a}</p></details>)}</div></section>
      <BetaInvitation><Reveal><span className={styles.eyebrow}><Mail size={16} aria-hidden="true" /> Help shape what comes next</span><h2>Your next book<br />starts <em>here.</em></h2><p>We’re looking for wedding, portrait and event photographers to try Stillbounds with their own work. Request a place in the private beta.</p></Reveal><Reveal delay={0.15}><BetaForm /></Reveal></BetaInvitation>
    </main>
    <footer className={styles.footer}><Link href="/mofolio" className={styles.logo}>Stillbounds<span>.</span></Link><span>by Moyo Ayaworan.</span><div><Link href="/photography">Photography <ArrowUpRight size={14} /></Link><Link href="/mofolio/terms">Terms</Link><Link href="/mofolio/privacy">Privacy</Link><a href="mailto:ijabikenm@gmail.com?subject=Stillbounds%20beta">Contact</a></div></footer><div className={styles.footerWordmark} aria-hidden="true">Stillbounds<span>.</span></div>
  </div>;
}
