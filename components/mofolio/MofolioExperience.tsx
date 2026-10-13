'use client';

import { useRef, useState, useSyncExternalStore, type ReactNode, type PointerEvent } from 'react';
import Image from 'next/image';
import { motion, useMotionValue, useReducedMotion, useScroll, useTransform, type MotionValue } from 'framer-motion';
import { ArrowDown, ArrowLeft, ArrowRight, GripVertical, Move, RotateCcw, Shuffle } from 'lucide-react';
import styles from './mofolio.module.css';

const photos = [
  { src: '/mofolio/stock-couple.webp', alt: 'A wedding couple together in warm evening light' },
  { src: '/mofolio/stock-bride.webp', alt: 'A bridal portrait with a bouquet in natural sunlight' },
  { src: '/mofolio/stock-ceremony.webp', alt: 'Flowers beside woven chairs at an outdoor wedding' },
];
const bookPhotos = [...photos, { src: '/mofolio/stock-table.webp', alt: 'An outdoor wedding table with flowers and glassware' }];
const compositions = [
  { name: 'The opening', caption: 'Let one photograph lead.', frames: [[12, 10, 30, 80], [56, 17, 17, 66], [76, 17, 17, 66]] },
  { name: 'In conversation', caption: 'Three moments, held together.', frames: [[8, 15, 25, 70], [37.5, 15, 25, 70], [67, 15, 25, 70]] },
  { name: 'A different rhythm', caption: 'Change the scale. Change the feeling.', frames: [[8, 18, 34, 64], [57, 10, 18, 38], [72, 53, 18, 38]] },
];
const ease = [0.22, 1, 0.36, 1] as const;
const subscribeToHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

// The first client render matches the static server render, including when
// the visitor has requested reduced motion before opening the page.
export function useMofolioMotionReduction() {
  const hydrated = useSyncExternalStore(subscribeToHydration, clientSnapshot, serverSnapshot);
  const reduced = useReducedMotion();
  return !hydrated || !!reduced;
}

export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduced = useMofolioMotionReduction();
  return <motion.div className={className} initial={false} whileInView={reduced ? undefined : { y: [44, 0], opacity: [0.35, 1] }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.85, delay, ease }}>{children}</motion.div>;
}


export function MotionTitle() {
  const reduced = useMofolioMotionReduction();
  return <h1 id="hero-title">{['Great photos.', 'Even better', 'together.'].map((line, index) =>
    <span className={styles.titleMask} key={line}><motion.span initial={false} animate={reduced ? {y: 0, opacity: 1} : {y: ['105%', '0%'], opacity: [0.2, 1]}} transition={{duration: 1, delay: index * 0.16, ease}}>{index === 2 ? <em>{line}</em> : line}</motion.span></span>
  )}</h1>;
}

// Subscribe once per cinematic scene; mobile uses shorter distances within the same sequence.
const subscribeToSmallScreen = (notify: () => void) => {
  const media = window.matchMedia('(max-width: 640px)');
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
};
const smallScreenSnapshot = () => window.matchMedia('(max-width: 640px)').matches;
function useSmallScreen() {
  return useSyncExternalStore(subscribeToSmallScreen, smallScreenSnapshot, () => false);
}

export function EditorShowcase({ children }: { children: ReactNode }) {
  const target = useRef<HTMLDivElement>(null);
  const reduced = useMofolioMotionReduction();
  const small = useSmallScreen();
  const {scrollYProgress} = useScroll({target, offset: ['start 95%', 'start 20%']});
  const rotateX = useTransform(scrollYProgress, [0, 0.85], [16, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.85], [0.84, 1]);
  const y = useTransform(scrollYProgress, [0, 0.85], [85, 0]);
  const leftAngle = useTransform(scrollYProgress, [0.12, 0.72], [0, small ? -95 : -110]);
  const rightAngle = useTransform(scrollYProgress, [0.12, 0.72], [0, small ? 95 : 110]);
  const bookOpacity = useTransform(scrollYProgress, [0.55, 0.8], [1, 0]);
  return <div ref={target} className={styles.editorPerspective}>
    <motion.div className={styles.editorImage} style={reduced ? {} : {rotateX, scale, y}}>{children}</motion.div>
    {!reduced && <motion.div className={styles.editorBookPortal} aria-hidden="true" style={{opacity: bookOpacity}}>
      <motion.div className={styles.portalLeft} style={{rotateY: leftAngle}}><PageFace index={0} side="left" /></motion.div>
      <motion.div className={styles.portalRight} style={{rotateY: rightAngle}}><PageFace index={0} side="right" /></motion.div>
      <span className={styles.portalLabel}>Your book. Your workspace.</span>
    </motion.div>}
  </div>;
}

function GatheringPhoto({ index, progress, still }: { index: number; progress: MotionValue<number>; still: boolean }) {
  const begin = 0.04 + index * 0.07;
  const x = useTransform(progress, [begin, 0.45], [['-110%', '30%', '130%'][index], '0%']);
  const y = useTransform(progress, [begin, 0.45], [['-65%', '75%', '-85%'][index], '0%']);
  const rotate = useTransform(progress, [begin, 0.37, 0.45], [[-28, 24, 32][index], [-3, 3, -3][index], 0]);
  const scale = useTransform(progress, [begin, 0.35, 0.45], [1.2, 0.96, 1]);
  const frame = compositions[0].frames[index];
  return <motion.div className={styles.gatheringPhoto} style={{ left: `${frame[0]}%`, top: `${frame[1]}%`, width: `${frame[2]}%`, height: `${frame[3]}%`, ...(still ? {} : { x, y, rotate, scale }) }}>
    <Image src={photos[index].src} alt="" fill unoptimized sizes="(max-width: 640px) 30vw, 28vw" loading="eager" draggable={false} />
  </motion.div>;
}

export function AlbumAssembly() {
  const target = useRef<HTMLDivElement>(null);
  const reduced = useMofolioMotionReduction();
  const small = useSmallScreen();
  const { scrollYProgress } = useScroll({ target, offset: ['start 80%', 'end 80%'] });
  const paperOpacity = useTransform(scrollYProgress, [0, 0.42], [0.08, 1]);
  const flyingOpacity = useTransform(scrollYProgress, [0.42, 0.48], [1, 0]);
  const boundOpacity = useTransform(scrollYProgress, [0.42, 0.48], [0, 1]);
  const closeAngle = useTransform(scrollYProgress, [0.56, 0.86], [0, 180]);
  const rotate = useTransform(scrollYProgress, [0.48, 0.9], [0, small ? -6 : -12]);
  const rotateY = useTransform(scrollYProgress, [0.48, 0.9], [0, small ? -10 : -20]);
  const scale = useTransform(scrollYProgress, [0.48, 0.9], [1, small ? 0.9 : 0.82]);
  const x = useTransform(scrollYProgress, [0.48, 0.9], ['0%', '-15%']);
  const progressScale = useTransform(scrollYProgress, [0, 0.9], [0, 1]);
  const firstLabel = useTransform(scrollYProgress, [0.4, 0.52], [1, 0]);
  const lastLabel = useTransform(scrollYProgress, [0.5, 0.7], [0, 1]);
  const flat = reduced;
  return <div ref={target} className={styles.assemblyScene} data-still={reduced || undefined}>
    <div className={styles.assemblySticky}>
      <div className={styles.assemblyHeading}><span className={styles.eyebrow}>Photographs → a story</span><span className={styles.scrollCue}><ArrowDown size={14} aria-hidden="true" /> Scroll to build the book</span></div>
      <div className={styles.assemblyCanvas} role="img" aria-label="Wedding photographs fly into an album spread, then fold into a finished book as you scroll">
        <motion.div className={styles.assemblyBook} style={flat ? {} : {rotate, rotateY, scale, x}} aria-hidden="true">
          {flat ? <><motion.div className={styles.assemblyPaper} style={reduced ? {} : {opacity: paperOpacity}} />{photos.map((photo,index) => <GatheringPhoto key={photo.src} index={index} progress={scrollYProgress} still={reduced} />)}<span className={styles.assemblyFold} /></> : <>
            <motion.div className={styles.assemblyFlight} style={{opacity:flyingOpacity}}>{photos.map((photo,index) => <GatheringPhoto key={photo.src} index={index} progress={scrollYProgress} still={false} />)}</motion.div>
            <motion.div className={styles.assemblyRight} style={{opacity:boundOpacity}}>
              <motion.div className={styles.assemblyPaper} style={{opacity: paperOpacity}} />
              <div className={styles.assemblyArtwork} data-side="right">{photos.map((photo,index) => <GatheringPhoto key={photo.src} index={index} progress={scrollYProgress} still={true} />)}</div>
            </motion.div>
            <motion.div className={styles.assemblyLeft} style={{rotateY: closeAngle, opacity:boundOpacity}}>
              <div className={styles.assemblyFront}><motion.div className={styles.assemblyPaper} style={{opacity: paperOpacity}} /><div className={styles.assemblyArtwork}>{photos.map((photo,index) => <GatheringPhoto key={photo.src} index={index} progress={scrollYProgress} still={true} />)}</div></div>
              <div className={styles.assemblyCover}><span>STILLBOUNDS / VOLUME 01</span><strong>A day<br />to remember.</strong><span>THE WEDDING EDIT</span></div>
            </motion.div>
            <span className={styles.assemblyFold} />
          </>}
        </motion.div>
      </div>
      <div className={styles.assemblyProgress} aria-hidden="true"><motion.span style={reduced ? {scaleX:1} : {scaleX:progressScale}} /></div>
      <div className={styles.assemblyFoot}><div className={styles.assemblyChapters}>{flat ? <span>A little order. A whole new feeling.</span> : <><motion.span style={{opacity:firstLabel}}>01 — Find the rhythm.</motion.span><motion.span style={{opacity:lastLabel}}>02 — Make something worth keeping.</motion.span></>}</div><a href="#experience">Now make it yours <ArrowDown size={14} aria-hidden="true" /></a></div>
    </div>
  </div>;
}

export function BetaInvitation({children}: {children: ReactNode}) {
  const target = useRef<HTMLElement>(null);
  const reduced = useMofolioMotionReduction();
  const small = useSmallScreen();
  const {scrollYProgress} = useScroll({target, offset: ['start 95%', 'start 35%']});
  const rotateY = useTransform(scrollYProgress, [0.05, 0.9], [0, small ? -110 : -165]);
  const opacity = useTransform(scrollYProgress, [0.65, 0.95], [1, 0]);
  return <section ref={target} className={`${styles.beta} ${styles.invitationScene}`} id="beta">
    {children}
    {!reduced && <motion.div className={styles.invitationLeaf} aria-hidden="true" style={{rotateY,opacity}}>
      <div className={styles.invitationFront}><span>THE LAST PAGE</span><strong>The next story<br />is yours.</strong><span>Stillbounds · by Moyo Ayaworan</span></div>
      <div className={styles.invitationBack} />
    </motion.div>}
  </section>;
}

function CropPlayground() {
  const [width, setWidth] = useState(54);
  const [dragging, setDragging] = useState(false);
  const canvas = useRef<HTMLDivElement>(null);
  const resizeStart = useRef<{ x: number; width: number; canvasWidth: number } | null>(null);
  const cropStart = useRef({ x: 50, y: 35 });
  const cropX = useMotionValue(50), cropY = useMotionValue(35);
  const position = useTransform([cropX, cropY], ([x, y]) => `${x}% ${y}%`);
  const constrain = (value: number) => Math.max(0, Math.min(100, value));
  function reset() { setWidth(54); cropX.set(50); cropY.set(35); }
  function beginResize(event: PointerEvent<HTMLButtonElement>) {
    const canvasWidth = canvas.current?.getBoundingClientRect().width || 1;
    resizeStart.current = { x: event.clientX, width, canvasWidth };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function resize(event: PointerEvent<HTMLButtonElement>) {
    const start = resizeStart.current;
    if (start) setWidth(Math.max(35, Math.min(85, start.width + (event.clientX - start.x) / start.canvasWidth * 100)));
  }
  return <div className={styles.cropDemo}>
    <div className={styles.cropToolbar}><span><Move size={14} aria-hidden="true" /> Your finishing touch</span><button type="button" onClick={reset}><RotateCcw size={14} aria-hidden="true" /> Reset crop</button></div>
    <div className={styles.cropCanvas} ref={canvas}>
      <div className={styles.cropFrame} style={{ width: `${width}%` }}>
        <motion.div className={styles.cropPhoto} data-dragging={dragging || undefined}
          onPanStart={() => { cropStart.current = { x: cropX.get(), y: cropY.get() }; setDragging(true); }}
          onPan={(_, info) => { cropX.set(constrain(cropStart.current.x - info.offset.x / 3)); cropY.set(constrain(cropStart.current.y - info.offset.y / 3)); }}
          onPanEnd={() => setDragging(false)}>
          <motion.img src={photos[0].src} alt="Crop demonstration: a couple at an outdoor wedding" draggable={false} style={{ objectPosition: position }} />
          <span className={styles.cropGrid} aria-hidden="true" />
          <span className={styles.dragLabel}><Move size={13} aria-hidden="true" /> Drag the photograph</span>
        </motion.div>
        <button type="button" className={styles.resizeHandle} aria-label="Resize photo frame" onPointerDown={beginResize} onPointerMove={resize} onPointerUp={() => { resizeStart.current = null; }} onPointerCancel={() => { resizeStart.current = null; }} onKeyDown={event => { if (['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); setWidth(value => Math.max(35, Math.min(85, value + (event.key === 'ArrowRight' ? 5 : -5)))); } }}><GripVertical size={16} aria-hidden="true" /></button>
      </div>
    </div>
    <div className={styles.cropControls}><label>Frame width<input type="range" min="35" max="85" value={width} onChange={event => setWidth(Number(event.target.value))} /></label><div aria-label="Adjust crop with buttons"><button type="button" aria-label="Move crop up" onClick={() => cropY.set(constrain(cropY.get() - 10))}>↑</button><button type="button" aria-label="Move crop down" onClick={() => cropY.set(constrain(cropY.get() + 10))}>↓</button></div></div>
    <p className={styles.demoHint}>Drag to recrop. Pull the handle to resize. Slider and arrow controls work too.</p>
  </div>;
}

export function CompositionPlayground() {
  const [layout, setLayout] = useState(0);
  const reduced = useMofolioMotionReduction();
  const current = compositions[layout];
  const change = (direction: number) => setLayout(value => (value + direction + compositions.length) % compositions.length);
  return <section className={styles.playground} id="experience" aria-labelledby="playground-title">
    <Reveal className={styles.playgroundHeading}><div><span className={styles.eyebrow}>One shoot. Endless possibilities.</span><h2 id="playground-title">Find the layout.<br /><em>Feel the difference.</em></h2></div><p>Try a new rhythm, then refine the details. You decide where the story goes.</p></Reveal>
    <div className={styles.compositionWorkspace} role="group" aria-label="Live composition playground" onKeyDown={event => { if (event.target instanceof HTMLButtonElement && ['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); change(event.key === 'ArrowLeft' ? -1 : 1); } }}>
      <div className={styles.workspaceToolbar}><span><span className={styles.dot} /> Composition study</span><button type="button" className={styles.primary} onClick={() => change(1)}><motion.span key={layout} className={styles.shuffleIcon} initial={false} animate={reduced ? {} : {rotate: [0, 180]}} transition={{duration: 0.5, ease}}><Shuffle size={15} aria-hidden="true" /></motion.span> Shuffle the spread</button></div>
      <div className={styles.liveSpread}>
        {photos.map((photo, index) => { const frame = current.frames[index]; return <motion.div layout key={photo.src} className={styles.livePhoto} initial={false} style={{ left: `${frame[0]}%`, top: `${frame[1]}%`, width: `${frame[2]}%`, height: `${frame[3]}%` }} transition={{ layout: reduced ? {duration: 0} : {type: 'spring', stiffness: 150, damping: 19, delay: index * 0.085} }}><Image src={photo.src} alt={photo.alt} fill sizes="(max-width: 640px) 35vw, 30vw" draggable={false} /></motion.div>; })}
        <span className={styles.fold} aria-hidden="true" />
      </div>
      <div className={styles.workspaceBottom}><div aria-live="polite" aria-atomic="true"><strong>{current.name}</strong><span>{current.caption}</span></div><div className={styles.compositionDots}>{compositions.map((composition, index) => <button key={composition.name} type="button" onClick={() => setLayout(index)} aria-label={`Choose ${composition.name}`} aria-pressed={layout === index}>{String(index + 1).padStart(2, '0')}</button>)}</div></div>
    </div>
    <div className={styles.finishingRow}><Reveal><span className={styles.eyebrow}>Put your hand in the picture</span><h3>Make the frame fit<br /><em>the photograph.</em></h3><p>Composition is only the beginning. Move the crop, give an image more room, and keep adjusting until it feels right.</p><span className={styles.sampleLabel}>Interactive website studies · No files are uploaded or saved.</span></Reveal><CropPlayground /></div>
    <p className={styles.photoCredit}>Demo photography by <a href="https://www.pexels.com/@jonathanborba/" target="_blank" rel="noreferrer">Jonathan Borba / Pexels</a>.</p>
  </section>;
}

const spreads = [
  [{ photo: 0, frame: [10, 10, 31, 80] }, { photo: 1, frame: [60, 10, 31, 80] }],
  [{ photo: 2, frame: [11, 13, 29, 74] }, { photo: 3, frame: [55, 23, 40, 54] }],
  [{ photo: 0, frame: [8, 20, 34, 60] }, { photo: 1, frame: [57, 12, 18, 46] }, { photo: 2, frame: [76, 43, 18, 46] }],
];
function PageFace({ index, side }: { index: number; side: 'left' | 'right' }) {
  return <div className={styles.pageFaceImage}><div className={styles.readerArtwork} data-side={side}>{spreads[index].map(({ photo, frame }) => <div key={photo} className={styles.readerPhoto} style={{ left: `${frame[0]}%`, top: `${frame[1]}%`, width: `${frame[2]}%`, height: `${frame[3]}%` }}><Image src={bookPhotos[photo].src} alt="" fill sizes="(max-width: 640px) 35vw, 35vw" draggable={false} /></div>)}</div></div>;
}

export function BookReader() {
  const [page, setPage] = useState(0);
  const [leaf, setLeaf] = useState<{ from: number; to: number; direction: number } | null>(null);
  const reduced = useMofolioMotionReduction();
  const turning = useRef(false);
  function turn(delta: number) {
    if (turning.current || page + delta < 0 || page + delta >= spreads.length) return;
    if (reduced) { setPage(value => value + delta); return; }
    turning.current = true;
    setLeaf({ from: page, to: page + delta, direction: delta });
  }
  const leftPage = leaf && leaf.direction < 0 ? leaf.to : page;
  const rightPage = leaf && leaf.direction > 0 ? leaf.to : page;
  function finishTurn() {
    if (!leaf) return;
    setPage(leaf.to); setLeaf(null); turning.current = false;
  }
  return <section className={styles.readerSection} aria-labelledby="reader-title">
    <Reveal className={styles.readerHeading}><span className={styles.eyebrow}>See the whole story</span><h2 id="reader-title">There’s a feeling<br /><em>in the turn of a page.</em></h2><p>Step back from the tools. Move through a sample book, one spread at a time.</p></Reveal>
    <div hidden aria-hidden="true">{bookPhotos.map(photo => <Image key={photo.src} src={photo.src} width={1200} height={1800} alt="" loading="eager" sizes="(max-width: 640px) 35vw, 35vw" />)}</div>
    <div className={styles.readerBook} role="group" aria-label={`Sample Stillbounds book, spread ${page + 1} of ${spreads.length}`}>
      <div className={styles.readerHalfLeft}><PageFace index={leftPage} side="left" /></div>
      <div className={styles.readerHalfRight}><PageFace index={rightPage} side="right" /></div>
      {leaf && <motion.div key={`${leaf.from}-${leaf.to}`} className={styles.turningLeaf} data-direction={leaf.direction} initial={{ rotateY: 0 }} animate={{ rotateY: leaf.direction > 0 ? -180 : 180 }} transition={{ duration: reduced ? 0 : 0.8, ease }} onAnimationComplete={finishTurn}>
        <div className={styles.leafFront}><PageFace index={leaf.from} side={leaf.direction > 0 ? 'right' : 'left'} /><span className={styles.leafShade} /></div>
        <div className={styles.leafBack}><PageFace index={leaf.to} side={leaf.direction > 0 ? 'left' : 'right'} /><span className={styles.leafShade} /></div>
      </motion.div>}
      <span className={styles.fold} aria-hidden="true" />
      <button className={styles.pageHitLeft} type="button" aria-label="Turn to previous spread" disabled={page === 0 || !!leaf} onClick={() => turn(-1)} />
      <button className={styles.pageHitRight} type="button" aria-label="Turn to next spread" disabled={page === spreads.length - 1 || !!leaf} onClick={() => turn(1)} />
    </div>
    <div className={styles.readerControls}><button type="button" aria-label="Previous book spread" disabled={page === 0 || !!leaf} onClick={() => turn(-1)}><ArrowLeft size={18} aria-hidden="true" /></button><span aria-live="polite" aria-atomic="true">Spread {String(page + 1).padStart(2, '0')} <span>/ {String(spreads.length).padStart(2, '0')}</span></span><button type="button" aria-label="Next book spread" disabled={page === spreads.length - 1 || !!leaf} onClick={() => turn(1)}><ArrowRight size={18} aria-hidden="true" /></button></div>
    <p className={styles.readerNotice}>Click a page edge or use the arrows. Website book study using stock photography.</p>
  </section>;
}
