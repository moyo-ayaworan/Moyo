/** Coarse request context for studio visit emails; never returns IPs, coordinates or raw browser identifiers. */
function place(value:string|null,max=80){
 if(!value||value.length>max*3)return '';
 try{const text=decodeURIComponent(value).normalize('NFKC');if(/[\u0000-\u001f\u007f]/.test(text))return '';const decoded=text.trim();return decoded.length<=max&&/^[\p{L}\p{M}\p{N} .,'’()-]+$/u.test(decoded)?decoded:'';}catch{return '';}
}
export function visitContext(headers:Headers,onVercel=process.env.VERCEL==='1'){
 const ua=(headers.get('user-agent')||'').slice(0,1000);
 const tablet=/ipad|tablet/i.test(ua)||(/android/i.test(ua)&&!/mobile/i.test(ua));
 const device=tablet?'Tablet':/mobile|iphone|ipod|android/i.test(ua)?'Mobile':ua?'Desktop':'Unknown';
 const browser=/edg(?:e|a|ios)?\//i.test(ua)?'Microsoft Edge':/opr\/|opera/i.test(ua)?'Opera':/samsungbrowser\//i.test(ua)?'Samsung Internet':/firefox\/|fxios\//i.test(ua)?'Firefox':/chrome\/|crios\//i.test(ua)?'Chrome':/safari\//i.test(ua)&&/version\//i.test(ua)?'Safari':'Unknown';
 const os=/iphone|ipad|ipod/i.test(ua)?'iOS / iPadOS':/android/i.test(ua)?'Android':/windows/i.test(ua)?'Windows':/cros/i.test(ua)?'ChromeOS':/macintosh|mac os x/i.test(ua)?'macOS':/linux/i.test(ua)?'Linux':'Unknown';
 const code=onVercel?(headers.get('x-vercel-ip-country')||'').toUpperCase():'';
 let country='';if(/^[A-Z]{2}$/.test(code)){try{country=new Intl.DisplayNames(['en'],{type:'region'}).of(code)||code;}catch{country=code;}}
 const city=onVercel?place(headers.get('x-vercel-ip-city')):'';
 const region=onVercel?place(headers.get('x-vercel-ip-country-region'),40):'';
 const location=[city,region,country].filter((value,index,all)=>value&&all.indexOf(value)===index).join(', ')||'Unavailable';
 return {location,device,browser,os};
}
