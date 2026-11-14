'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AlbumAssembly, BookReader, CompositionPlayground, EditorShowcase, MotionTitle, Reveal, useMofolioMotionReduction } from './MofolioExperience';
import { ArrowRight, ArrowUpRight, BookOpen, Check, Laptop, Layers, LockKeyhole, Palette, Type } from 'lucide-react';
import styles from './mofolio.module.css';
import ThemeToggle from '@/components/ThemeToggle';

const downloads = [
  {
    "arch": "arm64",
    "name": "Apple Silicon",
    "version": "0.4.19",
    "minimumMacOS": "26.2",
    "downloadGB": "3.08",
    "installedGB": "4.52",
    "sha256": "a38ecd10e094aeef85dff30da9391f7d6c654396c1c0c8ebbdad72c722522470",
    "url": "https://stillbounds-downloads.mofolio.workers.dev/stillbounds/downloads/arm64"
  },
  {
    "arch": "x64",
    "name": "Intel",
    "version": "0.4.19",
    "minimumMacOS": "13.3",
    "downloadGB": "3.29",
    "installedGB": "4.71",
    "sha256": "3bf89adb7577a91626110966b74d80aaf07a224a1f915f0cd5d1834cbb0f48a5",
    "url": "https://stillbounds-downloads.mofolio.workers.dev/stillbounds/downloads/x64"
  }
] as const;

const appScreens = [
  {id:'setup',step:'01',title:'Choose the book you want to make.',text:'Start with a book type, name and preset or custom size. See the closed book and the open spread before you continue.',detail:'A spread means two facing pages.',width:1500,height:1000},
  {id:'modes',step:'02',title:'Choose how you want to work.',text:'Pick a visual style, then choose Keep my folders or Organise for me. Page planning and optional AI sit below those two clear choices.',detail:'You can design with your own folder groups and keep Gemma switched off.',width:1500,height:1000},
  {id:'folders',step:'03',title:'Your folders. One project.',text:'Add several folders, browse their photos and change their order. Choose Folder mode to keep your groups together, or Smart mode to suggest an arrangement.',detail:'Plan my pages is optional when you want to decide how many spreads each group receives.',width:1500,height:1000},
  {id:'ai',step:'04',title:'Find the AI results in one place.',text:'The Photo assistant brings people, expressions and photo categories together. Suggestions help you start; review uncertain results and change them whenever you need to.',detail:'Face, expression and grouping analysis stays active. Gemma descriptions and categories are optional, with device-based time estimates.',width:1500,height:1000},
  {id:'editor',step:'05',title:'Make every page your own.',text:'Work on the open book, choose a spread from the strip below and refine layouts, spacing, crops, backgrounds and text. Keep a composition by locking it before arranging again.',detail:'Your original photographs stay linked on your Mac. Edits are saved in the project.',width:1500,height:1000},
  {id:'review',step:'06',title:'Check the book before it leaves your Mac.',text:'Review photo and print warnings, preview the pages, then export your book. Check image resolution, crops, margins and your print lab’s requirements before delivery.',detail:'Save a linked project for everyday work, or choose a portable copy when you need to include the originals.',width:1500,height:1000},
];

const features = [
  {icon:BookOpen,title:'A starting point, already arranged.',text:'Choose your photographs and book settings. Build a draft, then make the composition your own.'},
  {icon:Layers,title:'Give every spread its own rhythm.',text:'Mix layouts in the same book. Adjust page margins, spacing and the balance between leading images and smaller details.'},
  {icon:Type,title:'Make the words part of the design.',text:'Add text and captions with bundled fonts, alignment, spacing and reusable text styles.'},
  {icon:Palette,title:'Finish it your way.',text:'Colour borders, paper texture, backgrounds, overlays and double exposure. Keep each adjustment editable.'},
];

export default function MofolioPage() {
  const reduced = useMofolioMotionReduction();
  return <div className={styles.page}>
    <header className={styles.header}>
      <Link href="/stillbounds" aria-label="Stillbounds home" className={styles.logo}>Stillbounds<span>.</span></Link>
      <nav aria-label="Stillbounds navigation"><a href="#experience">Play with layouts</a><a href="#inside">Inside the app</a><a href="#downloads">Download</a><a href="#launch">Launch offer</a><a href="#questions">Questions</a></nav>
      <div className={styles.headerActions}><ThemeToggle /><Link href="/stillbounds/account" className={styles.headerCta}>Your account <ArrowUpRight size={16} aria-hidden="true" /></Link></div>
    </header>
    <main>
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.heroTop}><span className={styles.eyebrow}><span className={styles.dot} /> Intelligent photobook design · For Mac</span><Link href="/photography" className={styles.studioLink}>by Moyo Ayaworan <ArrowUpRight size={15} aria-hidden="true" /></Link></div>
        <motion.div initial={false} animate={reduced ? {opacity:1} : {opacity:[0.6,1],y:[18,0]}} transition={{duration:0.8,ease:[0.22,1,0.36,1]}} className={styles.heroCopy}>
          <MotionTitle />
          <div className={styles.heroAside}><p>Turn a folder of photographs into a book worth keeping. Start with an arranged draft. Shuffle the layouts. Make every spread your own.</p><div className={styles.heroActions}><a href="#downloads" className={styles.primary}>Download for Mac <ArrowRight size={18} aria-hidden="true" /></a><a href="#experience" className={styles.secondary}>Play with a spread <ArrowRight size={15} aria-hidden="true" /></a></div><span className={styles.small}>Built for Intel and Apple Silicon Macs.</span></div>
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
      <section className={styles.appTour} id="inside" aria-labelledby="app-tour-title">
        <div className={styles.tourHeading}><span className={styles.eyebrow}>See the actual app</span><h2 id="app-tour-title">From folders<br /><em>to finished pages.</em></h2><p>Follow the workflow before you download. These are captures of the Stillbounds interface with a sample project. Open any screenshot to inspect the controls at full size.</p><nav aria-label="App walkthrough">{appScreens.map(screen=><a key={screen.id} href={`#app-${screen.id}`}>{screen.step} {screen.id==='ai'?'AI results':screen.id==='editor'?'Design':screen.id==='setup'?'Book size':screen.id==='folders'?'Folders':screen.id==='modes'?'Choose a mode':'Review & export'}</a>)}</nav></div>
        {appScreens.map(screen=><article className={styles.tourStep} id={`app-${screen.id}`} key={screen.id}><div className={styles.tourCopy}><span className={styles.eyebrow}>Step {screen.step}</span><h3>{screen.title}</h3><p>{screen.text}</p><p className={styles.tourDetail}>{screen.detail}</p></div><figure><a href={`/mofolio/app-graduation-${screen.id}.webp`} target="_blank" rel="noopener noreferrer" aria-label={`Open full-size screenshot: ${screen.title}`}><Image unoptimized src={`/mofolio/app-graduation-${screen.id}.webp`} width={screen.width} height={screen.height} sizes="(max-width: 900px) 90vw, 68vw" alt={`Stillbounds ${screen.id==='ai'?'AI results panel':screen.id==='setup'?'book setup dialog':screen.id==='modes'?'arrangement mode selection':screen.id==='folders'?'folder photo library':screen.id==='editor'?'book design workspace':'review workspace'} — ${screen.text}`} /></a><figcaption>Actual app interface · Sample project <span>Open full size ↗</span></figcaption></figure></article>)}
      </section>
      <section className={styles.editorSection}>
        <Reveal className={styles.sectionHeading}><div><span className={styles.eyebrow}>Inside Stillbounds</span><h2>A book at the centre.<br /><em>Tools where you need them.</em></h2></div><p>Add photos. Organise. Design. Review & export.<br />Move through a clear workspace, with photo tools that appear when you select an image.</p></Reveal>


        <EditorShowcase><Image unoptimized src="/mofolio/app-graduation-editor.webp" width={1500} height={1000} sizes="90vw" alt="Stillbounds editor with the folder library, sample graduation book and spread navigation" /></EditorShowcase>
        <p className={styles.caption}>Actual app interface · Sample project</p>
        <div className={styles.steps}>{[['01','Bring your photographs','Add one or several folders and choose your book size. Keep your folder groups or let Smart mode organise the photographs.'],['02','Find the flow','Assemble a draft. Try compositions, refine crops and add your finishing touches.'],['03','Keep and share the work','Save your project, take a quick snapshot or export a PDF for review.']].map(([n,title,text])=><article key={n}><span>{n}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>
      <BookReader />
      <section className={styles.localSection}><Reveal><LockKeyhole size={27} aria-hidden="true" /><span className={styles.eyebrow}>Your Mac. Your photographs.</span><h2>Keep the originals.<br /><em>Explore the possibilities.</em></h2></Reveal><Reveal delay={0.12}><p>Photo editing and local AI run on your Mac. The app needs internet for registration, email verification, initial activation and occasional licence checks. A valid offline licence lets you continue working without a constant connection. Frames, textures and photo effects are saved as editable settings; your source photographs stay unchanged.</p><p>Client links and any online services have their own connectivity requirements. This beta does not include a printing or delivery service.</p></Reveal></section>
      <section className={styles.localSection} id="launch" aria-labelledby="launch-title"><div><span className={styles.eyebrow}>The upcoming launch offer</span><h2 id="launch-title">30 days to explore.<br /><em>₦30,000 to keep creating.</em></h2></div><div><p>A one-time purchase after a 30-day free trial. No card is needed to start the trial, and it will not charge you automatically when it ends.</p><p>Register and verify your email, then sign in to activate your first laptop and start the trial. Use the same account on the website and in the app, with up to two activated laptops.</p><p>Download the app below. Creating an account does not start your trial; activating your first Mac does. Paid checkout is not open yet.</p><Link href="/stillbounds/account?mode=signup" className={styles.primary}>Create your account <ArrowRight size={18} aria-hidden="true" /></Link><p className={styles.small}>Already registered? Sign in on the same account page.</p></div></section>
      <section id="downloads" className={styles.downloadSection} aria-labelledby="downloads-title">
        <span className={styles.eyebrow}>Stillbounds for Mac · Includes offline models</span>
        <h2 id="downloads-title">Choose your Mac.<br /><em>Start your next book.</em></h2>
        <p>Open Apple menu → About This Mac. Choose Apple Silicon if it lists an M-series chip, or Intel if it lists an Intel processor.</p>
        <div className={styles.downloadCards}>{downloads.map(release => <article className={styles.downloadCard} key={release.arch}>
          <Laptop size={26} aria-hidden="true" /><h3>{release.name}</h3>
          <p>{release.arch === 'arm64' ? 'For M1 and newer M-series Macs.' : 'For Macs with an Intel processor.'}</p>
          <dl><div><dt>Requires</dt><dd>macOS {release.minimumMacOS} or later</dd></div><div><dt>ZIP download</dt><dd>{release.downloadGB} GB</dd></div><div><dt>Installed app</dt><dd>{release.installedGB} GB, plus room to unzip and store projects</dd></div></dl>
          <a className={styles.primary} href={release.url}>Download for {release.name} <ArrowRight size={18} aria-hidden="true" /></a>
        </article>)}</div>
        <h3 id="installation">Download and install, step by step</h3>
        <p>New to Mac? Follow these steps in order. <a href="/mofolio/Stillbounds-First-Time-Guide.txt" download>Save the complete first-time guide</a> for installation, your first book, editing, saving and export. From version 0.4.22, the same guide is also inside the ZIP beside the app.</p>
        <ol className={styles.installSteps}>
          <li><strong>Download your Mac edition.</strong> Keep your Mac awake and wait for the download to finish. You only need one edition. Allow space for both the ZIP and extracted app, plus your photographs and projects.</li>
          <li><strong>Find and unzip it.</strong> Click Finder, the blue smiling-face icon in the Dock, then Downloads in the sidebar. Double-click the completed Stillbounds ZIP to extract it. If you see Stillbounds-First-Time-Guide.txt beside the app, double-click it to read it in TextEdit.</li>
          <li><strong>If updating, save and quit first.</strong> In your existing Stillbounds, press Command+S to save your book, then Command+Q to quit before replacing the app. Keep your original photo folders and .mofolio project files.</li>
          <li><strong>Move the app to Applications.</strong> In Finder, drag Stillbounds.app from the extracted folder onto Applications in the sidebar. Hold the mouse or trackpad button while moving, then release. Choose Replace if Finder asks about an existing copy.</li>
          <li><strong>Open the installed copy.</strong> Click Applications in Finder and double-click Stillbounds. If Applications is missing from the sidebar, choose Go → Applications in Finder’s menu bar at the top of the screen.</li>
          <li><strong>If Apple cannot verify the developer.</strong> These builds are unsigned and unnotarized. For the copy downloaded using this page, choose Done or Cancel on the warning. Open Apple menu → System Settings → Privacy &amp; Security, scroll to Security, find the Stillbounds notice and click Open Anyway. Authenticate with your Mac login password or Touch ID if asked, then click Open in the confirmation. This is your Mac password, not your Stillbounds account password.</li>
          <li><strong>Sign in and activate.</strong> Follow the app’s instructions to continue in your browser. Register or sign in, verify your email and approve the sign-in code shown by the app. Return to Stillbounds to activate the Mac and start the 30-day trial. No card is required. Internet is needed for first activation and occasional licence checks.</li>
          <li><strong>Start a practice book.</strong> Keep your original photographs in their folders. Use a small set to try creating, editing and saving a book; the complete guide walks you through each step. After installation works, you can remove the downloaded ZIP and extra extracted app copy. Keep the app in Applications, your photographs and your saved projects.</li>
        </ol>
        <p className={styles.downloadNotice}>If macOS says the app is damaged or will damage your computer, or Open Anyway is unavailable, keep the exact message and contact support before continuing. The Open Anyway steps above apply to an unverified-developer warning. <a href="https://support.apple.com/en-us/102445" target="_blank" rel="noopener noreferrer">Read Apple’s instructions</a>.</p>
        <p>Keep your Mac awake while downloading and allow space for both the ZIP and extracted app. Need a hand? <a href="mailto:ijabikenm@gmail.com?subject=Stillbounds%20installation">Contact support</a>.</p>
      </section>
      <section className={styles.faq} id="questions"><div><span className={styles.eyebrow}>Before you begin</span><h2>A few good<br /><em>questions.</em></h2></div><div>{[
        ['Which computers does it support?','Separate Mac builds are available: Intel requires macOS Ventura 13.3 or later; M-series requires macOS 26.2 or later. Windows is not available.'],
        ['Is the app available to download?','Yes. Download the latest version below for Apple Silicon or Intel. Follow the installation steps below, or contact us if you need help.'],
        ['Which download should I choose?','Choose Apple Silicon for M-series Macs or Intel for Intel Macs. Open Apple menu → About This Mac to check your chip or processor. Download size and installed app size are shown with each edition below.'],
        ['Can I still design by hand?','Yes. Change layouts, spacing, crops, backgrounds and text. Lock a spread or keep a composition when you want automatic arrangement to leave it alone.'],
        ['What about AI and printing?','Local analysis and automated layout tools provide suggestions that need your review. We do not promise perfect selection, semantic storytelling or print certification. Review exported files against your chosen lab’s requirements.'],
        ['How much will it cost?','The planned launch price is ₦30,000 NGN, paid once after a 30-day free trial. No automatic subscription or trial-end charge. Checkout is not open yet.'],
        ['Do I have to use all the AI features?','No. Keep your folders in Folder mode, or choose Smart mode for automatic organisation. Face, expression and grouping analysis supports the workflow; Gemma descriptions and categories are optional. Processing time depends on your Mac and the photographs.'],
        ['Will importing duplicate my original photos?','The standard workflow links to your originals and creates previews and analysis data. Keep the original files available for export. Making a portable copy is a separate choice.'],
      ].map(([q,a])=><details key={q}><summary>{q}<span aria-hidden="true">+</span></summary><p>{a}</p></details>)}</div></section>

    </main>
    <footer className={styles.footer}><Link href="/stillbounds" className={styles.logo}>Stillbounds<span>.</span></Link><span>by Moyo Ayaworan.</span><div><Link href="/photography">Photography <ArrowUpRight size={14} /></Link><Link href="/stillbounds/terms">Terms</Link><Link href="/stillbounds/privacy">Privacy</Link><a href="mailto:ijabikenm@gmail.com?subject=Stillbounds%20beta">Contact</a></div></footer><div className={styles.footerWordmark} aria-hidden="true">Stillbounds<span>.</span></div>
  </div>;
}
