import Link from 'next/link';
import { ArrowDown, ArrowUpRight, Check, Download, Mail, ShieldCheck } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SeoImage from '@/components/SeoImage';
import { RegionalPrice, CurrencySelector } from '@/components/RegionalPricing';
import PaystackPurchase from '@/components/PaystackPurchase';
import { productPath, type StoreProduct } from '@/lib/productStory';
import { productShopPath } from '@/lib/productSections';
import ProductMedia from './ProductMedia';
import ProductComparison from './ProductComparison';
import s from './shop.module.css';
export default function ProductDetail({product,related,email,checkoutEnabled}:{product:StoreProduct;related:StoreProduct[];email:string;checkoutEnabled:boolean}) {
  const story=product.storefront,canBuy=checkoutEnabled&&(product.kind==='physical'||product.has_delivery_file);
  const contact=`mailto:${email}?subject=${encodeURIComponent('Product question: '+product.title)}`;
  return <main className={`${s.page} ${s.productPage}`}><Navbar/><div className={s.productContainer}>
    <nav aria-label="Breadcrumb" className={s.breadcrumb}><Link href={productShopPath(product.section)}>{product.section==='photography'?'Photography shop':'Fine Art shop'}</Link><span aria-hidden="true">/</span><span>{product.title}</span></nav>
    <div className={s.productHero}>
      <ProductMedia key={product.id} title={product.title} cover={product.image} images={story.gallery}/>
      <div className={s.productInformation}>
        <p className={s.eyebrow}>{story.category||'From the studio'} <span>{product.kind==='physical'?'Physical product':'Digital download'}</span></p>
        <h1>{product.title}</h1>
        {(story.tagline||product.details)&&<p className={s.tagline}>{story.tagline||product.details}</p>}
        <div className={s.priceLine}><span><RegionalPrice value={product.price}/></span><span>One-time purchase</span></div>
        {(story.compatibility.length>0||story.formats.length>0)&&<dl className={s.quickFacts}>{story.compatibility.length>0&&<div><dt>Made for</dt><dd>{story.compatibility.join(' · ')}</dd></div>}{story.formats.length>0&&<div><dt>File formats</dt><dd>{story.formats.join(' · ')}</dd></div>}</dl>}
        <section id="purchase" className={s.purchase} aria-label={`Purchase ${product.title}`} tabIndex={-1}>
          <CurrencySelector/>
          {canBuy?<PaystackPurchase productId={product.id} title={product.title} section={product.section} price={product.price} physical={product.kind==='physical'} stock={product.stock}/>:<a href={contact} className={s.primaryButton}>Ask the studio <ArrowUpRight size={17}/></a>}
          <div className={s.purchaseNotes}><p><ShieldCheck size={15}/>{canBuy?'Secure payment through Paystack':'Ordering details confirmed by the studio'}</p><p><Download size={15}/>{product.kind==='physical'?`Physical product · ${product.stock??0} available. Shipping is calculated before payment.`:'Digital product. No physical item is shipped.'}</p></div>
        </section>
        <a className={s.textLink} href={contact}><Mail size={15}/>Questions before you buy?</a>
        {(story.description||story.included.length>0||story.comparisons.length>0)&&<a href="#product-details" className={s.detailsLink}>Explore the details <ArrowDown size={15}/></a>}
      </div>
    </div>
    <div id="product-details" className={s.detailsSections}>
      {(story.description||story.included.length>0)&&<section className={s.detailSection}><div className={s.sectionHeading}><p className={s.eyebrow}>{product.kind==='physical'?'About this piece':'Inside the download'}</p><h2>A closer look.</h2></div><div className={s.sectionBody}>{story.description&&<p className={s.description}>{story.description}</p>}{story.included.length>0&&<div><h3>What’s included</h3><ul className={s.included}>{story.included.map((item,index)=><li key={index}><Check size={16}/><span>{item}</span></li>)}</ul></div>}</div></section>}
      {story.comparisons.length>0&&<section className={s.examples}><div className={s.sectionHeading}><p className={s.eyebrow}>In use</p><h2>See the difference.</h2></div><div className={s.exampleStack}>{story.comparisons.map((example,index)=><ProductComparison key={index} example={example} title={product.title}/>)}</div></section>}
      {(story.installation.length>0||story.compatibility.length>0)&&<section className={s.detailSection}><div className={s.sectionHeading}><p className={s.eyebrow}>Your workflow</p><h2>Ready when you are.</h2></div><div className={s.sectionBody}>{story.compatibility.length>0&&<div><h3>Compatibility</h3><ul className={s.simpleList}>{story.compatibility.map((item,index)=><li key={index}>{item}</li>)}</ul></div>}{story.installation.length>0&&<div><h3>Getting started</h3><ol className={s.instructions}>{story.installation.map((item,index)=><li key={index}><span>{String(index+1).padStart(2,'0')}</span><p>{item}</p></li>)}</ol></div>}</div></section>}
      {story.usageRights&&<section className={s.detailSection}><div className={s.sectionHeading}><p className={s.eyebrow}>Make it yours</p><h2>Usage & licence.</h2></div><p className={s.description}>{story.usageRights}</p></section>}
      {canBuy&&product.kind!=='physical'&&<section className={s.delivery}><div><p className={s.eyebrow}>From checkout to creating</p><h2>Your next steps.</h2></div><ol><li><span>01</span><h3>Use your email</h3><p>Enter the address you want to use for your receipt and download link.</p></li><li><span>02</span><h3>Complete payment</h3><p>Choose an available payment method in Paystack’s secure checkout.</p></li><li><span>03</span><h3>Get your download</h3><p>Return from Paystack after payment. Your download becomes available once payment is verified.</p></li></ol></section>}
    </div>
    {related.length>0&&<section className={s.related}><div className={s.collectionHeading}><div><p className={s.eyebrow}>Keep exploring</p><h2>More from the studio.</h2></div><Link href={productShopPath(product.section)} className={s.textLink}>View the collection <ArrowUpRight size={16}/></Link></div><div className={s.relatedGrid}>{related.map(item=><Link className={s.relatedCard} href={productPath(item.section,item)} key={item.id}><div><SeoImage src={item.image} alt={item.title} fill sizes="(min-width: 960px) 33vw, 75vw" unoptimized={/\.svg$/i.test(item.image)} className={s.relatedImage}/></div><p>{item.storefront.category||(item.kind==='physical'?'Physical product':'Digital product')}</p><h3>{item.title}<ArrowUpRight size={19}/></h3><span><RegionalPrice value={item.price}/></span></Link>)}</div></section>}
  </div><Footer/>
  <div className={s.mobileBuyBar}><div><span>{product.title}</span><strong><RegionalPrice value={product.price}/></strong></div><a href="#purchase">{canBuy?'Buy product':'Order details'}<ArrowUpRight size={17}/></a></div>
  </main>;
}
