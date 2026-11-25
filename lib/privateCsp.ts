import theme from './theme-script-hash.json';
export function privateCsp(nonce:string,development=false){
 if(!/^[a-zA-Z0-9+/=]{20,100}$/.test(nonce))throw Error('Invalid CSP nonce.');
 return ["default-src 'self'","base-uri 'self'","object-src 'none'","frame-ancestors 'none'","form-action 'self'",`script-src 'self' 'nonce-${nonce}' 'sha256-${theme.sha256}' 'sha256-${theme.productionSha256}' 'strict-dynamic'${development?" 'unsafe-eval'":''}`,"script-src-attr 'none'","style-src 'self' 'unsafe-inline'","img-src 'self' data: blob: https://res.cloudinary.com https://images.unsplash.com","media-src 'self' blob: https://res.cloudinary.com","font-src 'self' data:","connect-src 'self' https://api.cloudinary.com https://res.cloudinary.com"].join('; ');
}
