import {DEMO_PRODUCTS} from '../../site/data.js';
import {siteOrigin,supabase} from '../lib/_utils.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl=s=>{try{const x=new URL(s);return ['http:','https:'].includes(x.protocol)?x.href:''}catch{return String(s||'').startsWith('/images/')?s:''}};
export const handler=async ev=>{
  const raw=ev.path.split('/').pop()||'';let slug;try{slug=decodeURIComponent(raw)}catch{slug=''}
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))return {statusCode:404,body:'Not found'};
  let p;
  if(supabase&&process.env.SUPABASE_ANON_KEY){
    const u=`${supabase}/rest/v1/products?slug=eq.${encodeURIComponent(slug)}&is_active=eq.true&select=*&limit=1`;
    const r=await fetch(u,{headers:{apikey:process.env.SUPABASE_ANON_KEY,authorization:`Bearer ${process.env.SUPABASE_ANON_KEY}`}});
    if(!r.ok)return {statusCode:503,body:'Catalog unavailable'};
    p=(await r.json())?.[0];
  }else p=DEMO_PRODUCTS.find(x=>x.slug===slug);
  if(!p)return {statusCode:404,headers:{'Content-Type':'text/html; charset=utf-8'},body:'<h1>สินค้านี้ไม่พร้อมจำหน่าย</h1><a href="/">กลับหน้าร้าน</a>'};
  const domain=siteOrigin(ev.headers);const full=`${domain}/products/${slug}`;
  const title=`${p.title} | Second Life วังน้ำเย็น สระแก้ว`;
  const desc=`${p.title} — ${p.description||p.condition||''} เลือกชมสินค้า Second Life วังน้ำเย็น จ.สระแก้ว`.slice(0,260);
  let image=safeUrl(p.media?.find(m=>m.type==='image')?.url)||'/images/watch-gold.svg';if(image.startsWith('/'))image=domain+image;
  const ld={ '@context':'https://schema.org','@type':'Product',name:p.title,description:p.description||p.title,image:[image],sku:p.slug,itemCondition:'https://schema.org/UsedCondition',offers:{'@type':'Offer',url:full,priceCurrency:'THB',price:p.price,availability:p.stock>0?'https://schema.org/InStock':'https://schema.org/OutOfStock',itemCondition:'https://schema.org/UsedCondition',seller:{'@type':'Organization',name:'Second Life'}}};
  const structured=JSON.stringify(ld).replace(/</g,'\\u003c');
  const html=`<!doctype html><html lang="th"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><meta name="robots" content="index,follow"><link rel="canonical" href="${esc(full)}"><meta property="og:type" content="product"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:image" content="${esc(image)}"><script type="application/ld+json">${structured}</script><link rel="stylesheet" href="/style.css"></head><body><div class="announcement">✳ SECOND LIFE — CURATED FINDS IN SA KAEO</div><header class="header"><a class="brand" href="/"><span class="brand-icon">S<span>✳</span>L</span><span class="brand-stack"><strong>SECOND LIFE</strong><small>TIMEPIECES & MUSIC</small></span></a><a href="/">← BACK TO SHOP</a></header><main style="max-width:1150px;min-height:65vh;margin:60px auto;padding:0 5%;display:grid;grid-template-columns:1fr 1fr;gap:6%"><div><img style="width:100%;max-height:580px;object-fit:contain;background:#e9e4db" src="${esc(image)}" alt="${esc(p.title)}"></div><article style="padding:8% 0"><div class="eyebrow">${p.category==='watch'?'TIMEPIECES':'MUSIC ROOM'} / SECOND LIFE</div><h1 style="font:400 clamp(35px,5vw,62px)/1.15 Georgia,serif;margin:25px 0">${esc(p.title)}</h1><h2 style="font-size:27px;color:#967449">฿${Number(p.price).toLocaleString('th-TH')}</h2><p style="line-height:2;color:#666">${esc(p.description||'')}</p><p>${esc(p.condition||'')} · ${p.stock>0?'พร้อมจำหน่าย':'สินค้าหมด'}</p><a class="btn btn-primary" href="/?product=${encodeURIComponent(slug)}">${p.stock>0?'VIEW GALLERY & ADD TO BAG ↗':'VIEW PRODUCT GALLERY ↗'}</a><p style="margin-top:35px;color:#888">Second Life — วังน้ำเย็น จังหวัดสระแก้ว</p></article></main><footer><div class="footer-brand">SECOND LIFE<span>✳</span></div></footer></body></html>`;
  return {statusCode:200,headers:{'content-type':'text/html; charset=utf-8','cache-control':'public,max-age=120'},body:html};
};
