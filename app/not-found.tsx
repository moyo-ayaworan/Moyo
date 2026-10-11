import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Pause, Play } from 'lucide-react';
import styles from './not-found.module.css';
import NotFoundAtmosphere from '@/components/NotFoundAtmosphere';

function ErrorRibbon({ reverse = false }: { reverse?: boolean }) {
  return (
    <div className={`${styles.ribbon} ${reverse ? styles.reverse : ''}`}>
      <div className={styles.track}>
        {[0, 1].map((group) => (
          <div className={styles.ribbonGroup} key={group}>
            {[0, 1, 2].map((item) => (
              <div className={styles.frame} key={item}>
                <span className={styles.numerals}>404<span className={styles.dot}>.</span></span>
                <span className={styles.ribbonCaption}>A LITTLE LOST. STILL LOOKING.</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function NotFound() {
  return (
    <main className={styles.page}>
      <NotFoundAtmosphere>
        <div className={styles.depth}>
          <ErrorRibbon />
          <ErrorRibbon reverse />
        </div>
        <div className={styles.vignette} />
      </NotFoundAtmosphere>

      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="Moyo home">
          <Image src="/brand/moyo-logo-red.png" alt="" width={38} height={38} className={styles.logo} />
          <span>MOYO</span>
        </Link>
        <span className={styles.status}><span /> YOU ARE SOMEWHERE ELSE</span>
      </header>

      <section className={styles.message} aria-labelledby="not-found-title">
        <p className={styles.eyebrow}>404 / PAGE NOT FOUND</p>
        <h1 id="not-found-title">A little outside<br />the frame.</h1>
        <p className={styles.description}>This page is missing.<br />The work is still here.</p>
        <Link href="/" className={styles.homeLink}>Back to home <ArrowRight size={18} aria-hidden="true" /></Link>
      </section>

      <footer className={styles.footer}>
        <label className={styles.motionControl}>
          <input type="checkbox" className={styles.pauseInput} aria-label="Pause background animation" />
          <Pause size={13} className={styles.pauseIcon} aria-hidden="true" />
          <Play size={13} className={styles.playIcon} aria-hidden="true" />
          <span className={styles.pauseText}>PAUSE MOTION</span>
          <span className={styles.playText}>RESUME MOTION</span>
        </label>
        <nav aria-label="Explore Moyo’s work" className={styles.navigation}>
          <Link href="/photography">Photography <ArrowUpRight size={15} aria-hidden="true" /></Link>
          <Link href="/art">Art <ArrowUpRight size={15} aria-hidden="true" /></Link>
        </nav>
      </footer>
    </main>
  );
}
