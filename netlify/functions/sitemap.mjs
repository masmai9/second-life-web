import {DEMO_PRODUCTS} from '../../site/data.js';
import {siteOrigin,supabase} from '../lib/_utils.mjs';
export const handler=async event=>{
 let products=DEMO_PRODUCTS;
 if(supabase && process.env.SUPABASE_ANON_KEY){try{const r=await fetch(`${supabase}/rest/v1/products?select=slug&is_active=eq.true&limit=2000`,{headers:{apikey:process.env.SUPABASE_ANON_KEY,authorization:`Bearer ${process.env.SUPABASE_ANON_KEY}`}});if(r.ok)products=await r.json();else throw Error('DB unavailable')}catch(e){return {statusCode:503,body:'Sitemap temporarily unavailable'}}}
 const site=siteOrigin(event.headers).replace(/&/g,'&amp;');
 const entries=[`<url><loc>${site}/</loc><priority>1.0</priority></url>`,...products.map(p=>`<url><loc>${site}/products/${encodeURIComponent(p.slug)}</loc><priority>0.7</priority></url>`)].join('');
 return {statusCode:200,headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public,max-age=300'},body:`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`};
};
