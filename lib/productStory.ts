import { productShopPath, type ProductSection } from './productSections';
export type ProductImage = { url: string; alt: string; caption: string };
export type ProductComparison = { title: string; before: string; after: string; caption: string };
export type ProductStory = {
  category: string; tagline: string; description: string; usageRights: string;
  included: string[]; compatibility: string[]; formats: string[]; installation: string[];
  gallery: ProductImage[]; comparisons: ProductComparison[];
};
export const emptyProductStory = (): ProductStory => ({category:'',tagline:'',description:'',usageRights:'',included:[],compatibility:[],formats:[],installation:[],gallery:[],comparisons:[]});
export function publicProductImage(value: string) {
  if (!value || value.length>2048 || /[\x00-\x20\x7f]/.test(value)) return false;
  try {
    const url=new URL(value,'https://local.invalid');
    if(url.search||url.hash||url.username||url.password||url.port)return false;
    if(value.startsWith('/')&&!value.startsWith('//')) {
      const pathname=decodeURIComponent(url.pathname);
      if(url.origin!=='https://local.invalid'||pathname.includes('%')||pathname.includes('\\'))return false;
      return !/^\/(?:api|admin|client|collector|payments|private)(?:\/|$)/i.test(pathname)&&/\.(?:jpg|jpeg|png|webp|avif|gif|svg)$/i.test(pathname);
    }
    return url.protocol==='https:'&&((url.hostname==='res.cloudinary.com'&&/^\/[^/]+\/image\/upload\//.test(url.pathname))||url.hostname==='images.unsplash.com');
  }catch{return false;}
}
export function parseProductStory(input: unknown): ProductStory {
  if(input==null)return emptyProductStory();
  if(typeof input!=='object'||Array.isArray(input))throw Error('Product page details must be an object.');
  const raw=input as Record<string,unknown>;
  const text=(value:unknown,label:string,max:number)=>{
    if(value==null)return '';
    if(typeof value!=='string'||value.length>max)throw Error(`${label} must be text up to ${max} characters.`);
    return value.trim();
  };
  const lines=(key:string)=>{
    const value=raw[key];if(value==null)return [];
    if(!Array.isArray(value)||value.length>20)throw Error(`Use at most 20 lines for ${key}.`);
    return value.map(item=>text(item,key,300)).filter(Boolean);
  };
  const images=raw.gallery??[];
  if(!Array.isArray(images)||images.length>8)throw Error('Use at most 8 gallery images.');
  const gallery=images.map((item,index)=>{
    if(!item||typeof item!=='object'||Array.isArray(item))throw Error('Invalid gallery image.');
    const image={url:text(item.url,'Image URL',2048),alt:text(item.alt,'Image description',200),caption:text(item.caption,'Image caption',300)};
    if(!image.url&&!image.alt&&!image.caption)return null;
    if(!publicProductImage(image.url))throw Error(`Gallery image ${index+1} needs a public image. Upload it here; private delivery files cannot be used as previews.`);
    return image;
  }).filter((item):item is ProductImage=>item!==null);
  const examples=raw.comparisons??[];
  if(!Array.isArray(examples)||examples.length>4)throw Error('Use at most 4 before-and-after examples.');
  const comparisons=examples.map((item,index)=>{
    if(!item||typeof item!=='object'||Array.isArray(item))throw Error('Invalid before-and-after example.');
    const comparison={title:text(item.title,'Example title',100),before:text(item.before,'Before image',2048),after:text(item.after,'After image',2048),caption:text(item.caption,'Example caption',400)};
    if(!Object.values(comparison).some(Boolean))return null;
    if(!publicProductImage(comparison.before)||!publicProductImage(comparison.after))throw Error(`Example ${index+1} needs both public before and after images.`);
    return comparison;
  }).filter((item):item is ProductComparison=>item!==null);
  return {category:text(raw.category,'Product type',40),tagline:text(raw.tagline,'Short introduction',240),description:text(raw.description,'Description',6000),usageRights:text(raw.usageRights,'Usage terms',2000),included:lines('included'),compatibility:lines('compatibility'),formats:lines('formats'),installation:lines('installation'),gallery,comparisons};
}
export function readProductStory(input:unknown):ProductStory {try{return parseProductStory(input);}catch{return emptyProductStory();}}
export function productPath(section:ProductSection,product:{id:number;title:string}) {
  const slug=product.title.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70).replace(/-$/,'');
  return `${productShopPath(section)}/products/${product.id}${slug?'-'+slug:''}`;
}
export function productIdFromPath(value:string) {
  const match=/^([1-9]\d{0,9})(?:-[a-z0-9-]+)?$/.exec(value);
  const id=match?Number(match[1]):0;return Number.isSafeInteger(id)&&id>0&&id<=2147483647?id:null;
}
export function formatProductPrice(value: string) {
  const amount = value.trim().replace(/^(?:₦|NGN)\s*/i, '');
  if (!/^(?:\d+|[1-9]\d{0,2}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(amount)) return value;
  return `₦${Number(amount.replaceAll(',', '')).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
}
export type StoreProduct={id:number;title:string;price:string;details:string;image:string;section:ProductSection;has_delivery_file:boolean;kind?:'digital'|'physical';stock?:number;storefront:ProductStory};
// Explicit projection keeps paid delivery URLs and future admin-only fields off public pages.
export function publicStoreProduct(row:Record<string,unknown>):StoreProduct {
  const image=typeof row.image==='string'?row.image:'';
  return {id:Number(row.id),title:String(row.title||''),price:formatProductPrice(String(row.price||'')),details:String(row.details||''),image:publicProductImage(image)?image:'/image-placeholder.svg',section:row.section==='art'?'art':'photography',stock:row.product_kind==='physical'?Number(row.stock_available||0):undefined,kind:row.product_kind==='physical'?'physical':'digital',has_delivery_file:row.product_kind!=='physical'&&row.has_delivery_file===true,storefront:readProductStory(row.storefront)};
}
