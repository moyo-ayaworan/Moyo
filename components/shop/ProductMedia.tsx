'use client';
import { useState } from 'react';
import SeoImage from '@/components/SeoImage';
import type { ProductImage } from '@/lib/productStory';
import s from './shop.module.css';
export default function ProductMedia({title,cover,images}:{title:string;cover:string;images:ProductImage[]}) {
  const frames=[{url:cover,alt:title,caption:''},...images.filter(image=>image.url!==cover)];
  const [active,setActive]=useState(0);
  const frame=frames[active]||frames[0];
  return <div className={s.media}>
    <figure className={s.cover}><SeoImage src={frame.url||'/image-placeholder.svg'} alt={frame.alt||title} fill priority sizes="(min-width: 960px) 55vw, 100vw" unoptimized={/\.svg$/i.test(frame.url)} className={s.coverImage}/></figure>
    {frame.caption&&<p className={s.caption}>{frame.caption}</p>}
    {frames.length>1&&<div className={s.thumbnails} aria-label="Product images">{frames.map((image,index)=><button type="button" key={`${image.url}-${index}`} onClick={()=>setActive(index)} aria-label={`View image ${index+1}: ${image.alt||title}`} aria-pressed={active===index} className={active===index?s.thumbnailActive:s.thumbnail}><SeoImage src={image.url} alt="" fill sizes="72px" unoptimized={/\.svg$/i.test(image.url)} className={s.thumbnailImage}/></button>)}</div>}
  </div>;
}
