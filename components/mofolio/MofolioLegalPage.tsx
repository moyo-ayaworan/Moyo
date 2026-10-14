import Link from 'next/link';
import styles from './mofolio.module.css';
import type { LegalSection } from '@/lib/stillboundsLegal';

type Props = { title: string; introduction: string; sections: LegalSection[] };
export default function MofolioLegalPage({title, introduction, sections}: Props) {
  return <div className={styles.page}>
    <header className={styles.header}><Link className={styles.logo} href="/mofolio">Stillbounds<span>.</span></Link><Link className={styles.headerCta} href="/mofolio#beta">Request beta access</Link></header>
    <main className={styles.legalMain}>
      <Link className={styles.legalBack} href="/mofolio">← Back to Stillbounds</Link>
      <p className={styles.eyebrow}>Effective 14 October 2026</p>
      <h1>{title}</h1><p className={styles.legalIntro}>{introduction}</p>
      <nav className={styles.legalContents} aria-label={`${title} contents`}>{sections.map(([heading],index)=><a key={index} href={`#section-${index+1}`}>{String(index+1).padStart(2,'0')} · {heading}</a>)}</nav>
      <div className={styles.legalText}>{sections.map(([heading,paragraphs],index)=><section key={index} id={`section-${index+1}`}><h2>{index+1}. {heading}</h2>{paragraphs.map(paragraph=><p key={paragraph}>{paragraph}</p>)}</section>)}</div>
      <p className={styles.legalContact}>Questions? <a href="mailto:ijabikenm@gmail.com?subject=Stillbounds%20privacy">Contact Moyo Ayaworan</a>.</p>
    </main>
    <footer className={styles.footer}><Link className={styles.logo} href="/mofolio">Stillbounds<span>.</span></Link><span>by Moyo Ayaworan.</span><div><Link href="/mofolio/terms">Terms</Link><Link href="/mofolio/privacy">Privacy</Link></div></footer>
  </div>;
}
