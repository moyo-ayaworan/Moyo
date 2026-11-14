'use client';
import type { ProductSection } from '@/lib/productSections';
import { getStorageItem, setStorageItem } from '@/lib/browserStorage';
import { productShopPath } from '@/lib/productSections';
import { useRef, useState } from 'react';
import { formatProductPrice } from '@/lib/productStory';
import { ArrowUpRight, LoaderCircle } from 'lucide-react';
export default function PaystackPurchase({productId,title,section,price}:{productId:number;title:string;section:ProductSection;price?:string}) {
  const request=useRef<{email:string;key:string}|null>(null),pending=useRef(false);
  const [email,setEmail]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(false),[paymentPath,setPaymentPath]=useState('');
  const startCheckout=async(event:React.FormEvent)=>{
    event.preventDefault();if(pending.current)return;
    pending.current=true;setLoading(true);setError('');
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),25000);
    try{
      const normalizedEmail=email.trim().toLowerCase();
      const storageKey=`shop-checkout:${section}:${productId}:${normalizedEmail}`;
      if(!request.current||request.current.email!==normalizedEmail) {
        const stored=getStorageItem('local',storageKey);
        const key=stored&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(stored)?stored:crypto.randomUUID();
        request.current={email:normalizedEmail,key};
        setStorageItem('local',storageKey,key);
      }
      const response=await fetch('/api/paystack/initialize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({productId,email:normalizedEmail,section,requestKey:request.current.key}),signal:controller.signal});
      const data=await response.json().catch(()=>({}));
      if(typeof data.paymentPath==='string'&&data.paymentPath.startsWith(`${productShopPath(section)}/payment?reference=`))setPaymentPath(data.paymentPath);
      if(response.ok&&data.paymentPath) {
        const path=`${productShopPath(section)}/payment?reference=`;
        if(typeof data.paymentPath!=='string'||!data.paymentPath.startsWith(path))throw Error('Invalid payment return address.');
        window.location.assign(data.paymentPath);return;
      }
      if(!response.ok||!data.checkoutUrl)throw Error(data.error||'We could not open checkout. Please try again.');
      const checkout=new URL(data.checkoutUrl);
      if(checkout.protocol!=='https:'||checkout.hostname!=='checkout.paystack.com'||checkout.username||checkout.password||checkout.port||checkout.search||checkout.hash||!/^\/[A-Za-z0-9_-]+\/?$/.test(checkout.pathname))throw Error('Checkout could not be verified. Please contact the studio.');
      window.location.assign(checkout.href);
    }catch(checkoutError){
      setError(controller.signal.aborted?'Checkout is taking longer than expected. Retry with the same email; do not open another payment while you are unsure of its status.':checkoutError instanceof Error?checkoutError.message:'Unable to start checkout.');
      pending.current=false;setLoading(false);
    }finally{clearTimeout(timeout);}
  };
  return <form onSubmit={startCheckout} className="space-y-4" aria-busy={loading}>
    <div className="space-y-2"><label className="block text-xs text-foreground/75" htmlFor={`paystack-email-${productId}`}>Your email address</label><input id={`paystack-email-${productId}`} type="email" required inputMode="email" maxLength={254} autoComplete="email" autoCapitalize="none" spellCheck={false} disabled={loading} value={email} onChange={event=>setEmail(event.target.value)} placeholder="you@example.com" aria-describedby={`paystack-help-${productId}`} className="min-h-13 w-full border border-foreground/30 bg-transparent px-4 text-base text-foreground outline-none placeholder:text-foreground/35 focus:border-accent disabled:opacity-60"/><p id={`paystack-help-${productId}`} className="text-[11px] leading-relaxed text-foreground/55">Your receipt and {title} download link will be sent here.</p></div>
    <p className="text-xs text-foreground/65">{price ? `Paystack will charge ${formatProductPrice(price)} in NGN. Your bank may apply conversion fees.` : 'Paystack charges in NGN.'}</p>
    <button type="submit" disabled={loading} className="inline-flex min-h-13 w-full items-center justify-between gap-3 border border-accent bg-accent px-5 py-4 text-xs font-medium text-white transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:opacity-60">{loading?'Opening secure checkout…':'Continue to payment'}{loading?<LoaderCircle size={17} className="motion-safe:animate-spin" aria-hidden="true"/>:<ArrowUpRight size={17} aria-hidden="true"/>}</button>
    {paymentPath&&<a href={paymentPath} className="block text-sm underline">Check original payment</a>}
    {error&&<p role="alert" className="border-l-2 border-red-400 pl-3 text-sm leading-relaxed text-red-400">{error}</p>}
  </form>;
}
