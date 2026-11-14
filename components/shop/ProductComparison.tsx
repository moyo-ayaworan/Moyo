'use client';
import { useId, useState } from 'react';
import SeoImage from '@/components/SeoImage';
import type { ProductComparison as Comparison } from '@/lib/productStory';
import s from './shop.module.css';
export default function ProductComparison({example,title}:{example:Comparison;title:string}) {
  const [position,setPosition]=useState(50),id=useId();
  return <figure className={s.comparison}>
    <div className={s.comparisonFrame}>
      <SeoImage src={example.after} alt={`${example.title||title}, after`} fill sizes="(min-width: 960px) 75vw, 100vw" className={s.comparisonImage}/>
      <div className={s.beforeImage} style={{clipPath:`inset(0 ${100-position}% 0 0)`}}><SeoImage src={example.before} alt={`${example.title||title}, before`} fill sizes="(min-width: 960px) 75vw, 100vw" className={s.comparisonImage}/></div>
      <span className={s.beforeLabel}>Before</span><span className={s.afterLabel}>After</span>
      <span className={s.divider} style={{left:`${position}%`}} aria-hidden="true"><span>↔</span></span>
      <input className={s.comparisonRange} type="range" min={0} max={100} value={position} onChange={event=>setPosition(Number(event.target.value))} aria-label={`Compare before and after: ${example.title||title}`} aria-describedby={id} aria-valuetext={`${position}% before, ${100-position}% after`}/>
    </div>
    <figcaption className={s.comparisonCaption}><div>{example.title&&<h3>{example.title}</h3>}{example.caption&&<p>{example.caption}</p>}</div><p id={id}>Drag to compare. Use arrow keys when the slider is focused.</p></figcaption>
  </figure>;
}
