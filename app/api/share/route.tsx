/* ImageResponse renders img into a PNG; next/image is not supported here. */
/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { sharePreviewImage } from '@/lib/sharePreview';
import { isPrivatePage } from '@/lib/privatePaths';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
export const runtime='nodejs';
export async function GET(req:NextRequest){
 const path=req.nextUrl.searchParams.get('path') || '/';
 if(!/^\/[a-z0-9/-]*$/i.test(path)||path.length>240||isPrivatePage(path)||path.startsWith('/api'))return new Response(null,{status:404});
 const title=(req.nextUrl.searchParams.get('title') || path.split('/').filter(Boolean).join(' / ') || 'Photography & Fine Art').slice(0,100);
 const description=(req.nextUrl.searchParams.get('description') || '').slice(0,180);
 let image='';
 try{
  const source=await sharePreviewImage(path);let bytes:Buffer|undefined;
  if(source.startsWith('/')&&!source.startsWith('//')){const root=join(process.cwd(),'public');const file=resolve(root,source.slice(1));if(file.startsWith(root+'/'))bytes=await readFile(file);}
  else if(source){const url=new URL(source);if(url.protocol==='https:'&&['res.cloudinary.com','images.unsplash.com'].includes(url.hostname)){const r=await fetch(url,{signal:AbortSignal.timeout(5000),redirect:'error'});if(r.ok&&Number(r.headers.get('content-length')||0)<15_000_000){const b=Buffer.from(await r.arrayBuffer());if(b.length<15_000_000)bytes=b;}}}
  if(bytes)image=`data:image/jpeg;base64,${(await sharp(bytes).rotate().resize(660,630,{fit:'cover'}).jpeg({quality:85}).toBuffer()).toString('base64')}`;
 }catch{}
 return new ImageResponse(<div style={{display:'flex',width:'100%',height:'100%',background:'#fbfaf7',color:'#080808'}}><div style={{display:'flex',flexDirection:'column',justifyContent:'space-between',padding:'48px',width:image?'48%':'100%'}}><div style={{display:'flex',fontSize:18,letterSpacing:4,color:'#920110'}}>MOYO AYAWORAN</div><div style={{display:'flex',flexDirection:'column'}}><div style={{display:'flex',fontSize:title.length>55?42:54,lineHeight:1.1,letterSpacing:-2}}>{title}</div>{description&&<div style={{display:'flex',fontSize:20,lineHeight:1.5,color:'#666666',marginTop:24}}>{description}</div>}</div><div style={{display:'flex',fontSize:16,color:'#666666'}}>moyoayaworan.com{path==='/'?'':path}</div></div>{image&&<img src={image} alt="" width={624} height={630} style={{objectFit:'cover'}}/>}</div>,{width:1200,height:630,headers:{'Cache-Control':'public, max-age=300, s-maxage=300'}});
}
