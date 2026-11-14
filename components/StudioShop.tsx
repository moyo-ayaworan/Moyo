'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Mail, Search } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SeoImage from '@/components/SeoImage';
import { productPath, readProductStory, type StoreProduct } from '@/lib/productStory';
import type { ProductSection } from '@/lib/productSections';
import s from '@/components/shop/shop.module.css';
type Artwork={id:number;title:string;image:string;price?:string;medium?:string;dimensions?:string;description?:string};
type Collection={section:ProductSection;artworks:Artwork[];products:StoreProduct[];email:string;checkout_enabled:boolean};
export default function StudioShop({section}:{section:ProductSection}) {
  const [loadedCollection,setCollection]=useState<Collection|null>(null),[error,setError]=useState(false),[attempt,setAttempt]=useState(0),[search,setSearch]=useState(''),[category,setCategory]=useState('All products');
  const collection=loadedCollection?.section===section?loadedCollection:null;
  useEffect(()=>{
    const controller=new AbortController();
    fetch(`/api/shop?section=${section}`,{signal:controller.signal,cache:'no-store'}).then(async response=>{
      if(!response.ok)throw Error('Collection unavailable');const data=await response.json();
      if(!Array.isArray(data.artworks)||!Array.isArray(data.products))throw Error('Invalid collection');
      if(!controller.signal.aborted)setCollection({...data,products:data.products.map((product:StoreProduct)=>({...product,storefront:readProductStory(product.storefront)}))});
    }).catch(()=>{if(!controller.signal.aborted)setError(true);});return()=>controller.abort();
  },[section,attempt]);
  useEffect(()=>{if(collection){const target=window.location.hash.slice(1);if(/^(?:product|print)-[1-9]\d*$/.test(target))document.getElementById(target)?.scrollIntoView({block:'start'});}},[collection]);
  const categories=useMemo(()=>Array.from(new Set((collection?.products||[]).map(product=>product.storefront.category).filter(Boolean))),[collection]);
  const products=useMemo(()=>(collection?.products||[]).filter(product=>(category==='All products'||product.storefront.category===category)&&`${product.title} ${product.details} ${product.storefront.tagline} ${product.storefront.category}`.toLowerCase().includes(search.trim().toLowerCase())),[collection,category,search]);
  const inquiry=(item?:Artwork)=>section==='art'?item?`/art/commissions?artworkId=${item.id}&title=${encodeURIComponent(item.title)}`:'/art/commissions?type=private-viewing':`mailto:${collection?.email||'ijabikenm@gmail.com'}?subject=Photography%20product%20question`;
  const reset=()=>{setSearch('');setCategory('All products');};
  return <main className={s.page}><Navbar/><div className={s.catalogContainer}>
    <header className={s.catalogHeader}><div><p className={s.eyebrow}>Studio shop / {section==='photography'?'Photography':'Fine Art'}</p><h1>{section==='photography'?'Made in the studio. Ready for yours.':'A different way to live with art.'}</h1></div><p>{section==='photography'?'Digital products for your creative practice. Explore each release, see what’s included and find what fits your workflow.':'Available works, digital editions and resources from the fine-art practice. Discover the details of each piece.'}</p></header>
    {!collection&&!error&&<p className="py-20 text-sm text-foreground/60" role="status">Loading the collection…</p>}
    {error&&<div className={s.empty} role="alert"><h2>The collection is taking a moment.</h2><p>Please try again, or contact the studio if you need help with an order.</p><button onClick={()=>{setError(false);setAttempt(value=>value+1);}}>Try again <ArrowUpRight size={15}/></button></div>}
    {collection&&!collection.products.length&&!collection.artworks.length&&<div className={s.empty}><h2>Between collections.</h2><p>There are no products available right now. Explore the archive or contact the studio about future releases.</p><Link href={section==='photography'?'/photography':'/art/works'}>Explore the archive <ArrowUpRight size={15}/></Link></div>}
    {!!collection?.products.length&&<section className={s.catalogSection} aria-label="Digital products"><div className={s.catalogSectionHeading}><h2>The digital collection</h2><span>{collection.products.length} {collection.products.length===1?'product':'products'}</span></div>
      {(collection.products.length>1||categories.length>1)&&<div className={s.browseTools}><label className={s.search}><Search size={16}/><span className="sr-only">Search digital products</span><input type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search the collection"/></label>{categories.length>1&&<div className={s.filters} aria-label="Product type">{['All products',...categories].map(item=><button key={item} className={category===item?s.filterActive:s.filter} aria-pressed={category===item} onClick={()=>setCategory(item)}>{item}</button>)}</div>}</div>}
      <div className={`${s.catalogGrid} ${collection.products.length===1?s.singleProduct:''}`}>{products.map(product=><article className={s.catalogCard} key={product.id} id={`product-${product.id}`}><Link href={productPath(section,product)} className={s.catalogImage} aria-label={`Explore ${product.title}`}><SeoImage src={product.image} alt={product.title} fill sizes="(min-width: 1100px) 33vw, (min-width: 640px) 50vw, 100vw" unoptimized={/\.svg$/i.test(product.image)}/></Link><div className={s.cardBody}><p>{product.storefront.category||'Digital product'}</p><Link href={productPath(section,product)} className={s.cardTitle}><h3>{product.title}</h3><span>{product.price}</span></Link>{(product.storefront.tagline||product.details)&&<p className={s.cardSummary}>{product.storefront.tagline||product.details}</p>}<Link href={productPath(section,product)} className={s.cardAction}>Explore product <ArrowUpRight size={18}/></Link></div></article>)}</div>
      {!products.length&&<div className={s.empty} role="status"><h2>Nothing here just yet.</h2><p>Try another title or clear your filters to see the full collection.</p><button onClick={reset}>Clear search and filters</button></div>}
    </section>}
    {section==='art'&&!!collection?.artworks.length&&<section className={s.catalogSection} aria-label="Available artworks"><div className={s.catalogSectionHeading}><h2>Available works</h2><span>Inquire with the studio</span></div><div className={s.catalogGrid}>{collection.artworks.map(item=><article className={s.catalogCard} id={`print-${item.id}`} key={item.id}><Link href={inquiry(item)} className={s.catalogImage}><SeoImage src={item.image} alt={item.title} fill sizes="(min-width: 1100px) 33vw, (min-width: 640px) 50vw, 100vw"/></Link><div className={s.cardBody}><p>{[item.medium,item.dimensions].filter(Boolean).join(' / ')||'Fine Art'}</p><div className={s.cardTitle}><h3>{item.title}</h3><span>{item.price ? `₦${Number(item.price).toLocaleString('en-NG')}` : 'Price on request'}</span></div>{item.description&&<p className={s.cardSummary}>{item.description}</p>}<Link href={inquiry(item)} className={s.cardAction}>Inquire about this work <ArrowUpRight size={18}/></Link></div></article>)}</div></section>}
    <section className={s.shopNotes} aria-label="Shopping with the studio"><div><h2>Know what you’re getting.</h2><p>Each product has its own details, examples and delivery information.</p></div><div><h2>Pay securely.</h2><p>Digital products with online checkout are paid for through Paystack.</p></div><div><h2>Keep the connection.</h2><p>Your receipt and download link go to the email you use at checkout.</p></div></section>
    <section className={s.contact}><h2>A question for the studio?</h2><p>For product questions, print requests or help with an order, get in touch.</p><Link href={inquiry()} className={s.textLink}><Mail size={15}/>Contact the {section==='photography'?'photography':'fine art'} studio</Link></section>
  </div><Footer/></main>;
}
