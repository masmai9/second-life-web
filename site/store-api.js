import {DEFAULT_CATEGORIES,sortedCategories} from './categories.js';
import { DEMO_PRODUCTS } from './data.js';
const cfg = window.SECONDLIFE_CONFIG || {};
export const LIVE = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey);
const base = (cfg.supabaseUrl || '').replace(/\/$/, '');
const anon = cfg.supabaseAnonKey || '';
const demoKey = 'secondlife_demo_catalog_v1';
export const money = n => '฿' + Number(n || 0).toLocaleString('th-TH', {maximumFractionDigits:0});
export const escapeHtml = v => String(v ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function safeMediaUrl(url) { const s=String(url||''); if((s.startsWith('/') && !s.startsWith('//')) || s.startsWith('blob:') || s.startsWith('data:image/'))return s; try{const u=new URL(s); return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return s.startsWith('data:image/') ? s : '';} }
export function demoProducts() { try { const s=localStorage.getItem(demoKey); if(s)return JSON.parse(s); } catch {} return DEMO_PRODUCTS.map(p=>({...p})); }
export function setDemoProducts(p) { localStorage.setItem(demoKey,JSON.stringify(p)); }
export function getSession(){try{return JSON.parse(sessionStorage.getItem('secondlife_auth')||'null');}catch{return null;}}
export function setSession(s){if(s)sessionStorage.setItem('secondlife_auth',JSON.stringify(s));else sessionStorage.removeItem('secondlife_auth');}
async function authToken(){let s=getSession(); if(!s)return null;if(s.expires_at && Date.now()/1000 > s.expires_at-60 && s.refresh_token){const r=await fetch(`${base}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{apikey:anon,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:s.refresh_token})});if(r.ok){s=await r.json();setSession(s)}else{setSession(null);return null}}return s.access_token;}
export async function sbFetch(path, options={}) {
 if(!LIVE)throw Error('Supabase ไม่ได้ตั้งค่า');
 const token=await authToken();const headers={apikey:anon,Authorization:`Bearer ${token||anon}`,...options.headers};
 const r=await fetch(`${base}${path}`, {...options,headers});if(!r.ok){let msg;try{const e=await r.json();msg=e.message||e.error_description||e.error||JSON.stringify(e)}catch{msg=await r.text()}throw Error(msg||`HTTP ${r.status}`)}
 if(r.status===204)return null;const t=await r.text();return t?JSON.parse(t):null;
}
export async function listProducts(admin=false){if(!LIVE)return demoProducts().filter(p=>admin||p.is_active!==false);try{return await sbFetch(`/rest/v1/products?select=*&${admin?'':'is_active=eq.true&'}order=created_at.desc`)}catch(e){throw Error('โหลดสินค้าจากฐานข้อมูลไม่ได้: '+e.message)}}
export async function login(email,password){const r=await fetch(`${base}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:anon,'Content-Type':'application/json'},body:JSON.stringify({email,password})});const data=await r.json();if(!r.ok)throw Error(data.error_description||data.msg||'เข้าสู่ระบบไม่สำเร็จ');setSession(data);try{const rows=await sbFetch(`/rest/v1/admins?select=user_id&user_id=eq.${encodeURIComponent(data.user.id)}`);if(!rows?.length)throw Error('บัญชีนี้ไม่มีสิทธิ์ดูแลร้าน')}catch(e){setSession(null);throw e}return data;}
export async function isAdmin(){if(!LIVE)return true;const s=getSession();if(!s?.user?.id)return false;try{const r=await sbFetch(`/rest/v1/admins?select=user_id&user_id=eq.${encodeURIComponent(s.user.id)}`);return r?.length>0}catch{return false}}
export async function saveProduct(product){if(!LIVE){const items=demoProducts();const i=items.findIndex(p=>p.id===product.id);if(i>=0)items[i]=product;else items.unshift(product);setDemoProducts(items);return product}
 const isNew=!product.id || product.id.startsWith('demo-');
 const payload={slug:product.slug,title:product.title,category:product.category,price:product.price,stock:product.stock,condition:product.condition,description:product.description,media:product.media,is_active:product.is_active};
 const path=isNew?'/rest/v1/products':`/rest/v1/products?id=eq.${encodeURIComponent(product.id)}`;
 const result=await sbFetch(path,{method:isNew?'POST':'PATCH',headers:{'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(payload)});return result?.[0];
}
export async function deleteProduct(p){if(!LIVE){setDemoProducts(demoProducts().filter(x=>x.id!==p.id));return}await sbFetch(`/rest/v1/products?id=eq.${encodeURIComponent(p.id)}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({is_active:false})});}
export async function listOrders(){if(!LIVE)return[];return sbFetch('/rest/v1/orders?select=*&order=created_at.desc&limit=100');}
export async function uploadMedia(file){if(!LIVE){if(file.type.startsWith('video/'))throw Error('วิดีโอในโหมดทดลองให้ใช้ฐานข้อมูล Supabase ก่อน (ไม่เก็บไฟล์ใหญ่ในเบราว์เซอร์)');if(file.size>500_000)throw Error('โหมดทดลองรับรูปไม่เกิน 500 KB ต่อภาพ เพื่อไม่ให้พื้นที่เบราว์เซอร์เต็ม');return new Promise((ok,fail)=>{const rd=new FileReader;rd.onload=()=>ok({type:'image',url:rd.result});rd.onerror=()=>fail(Error('อ่านรูปไม่สำเร็จ'));rd.readAsDataURL(file)});}
 if(!file.type.startsWith('image/')&&!['video/mp4','video/webm','video/quicktime'].includes(file.type))throw Error('รองรับรูปภาพและ MP4/WebM/MOV เท่านั้น');
 if(file.size>(file.type.startsWith('video/')?45_000_000:8_000_000))throw Error('ไฟล์ใหญ่เกินขนาดที่กำหนด');
 const token=await authToken();if(!token)throw Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง');
 const ext=(file.name.split('.').pop()||'bin').toLowerCase().replace(/[^a-z0-9]/g,'');const fileName=`${crypto.randomUUID()}.${ext}`;
 const r=await fetch(`${base}/storage/v1/object/media/${fileName}`,{method:'POST',headers:{apikey:anon,Authorization:`Bearer ${token}`,'Content-Type':file.type,'x-upsert':'false'},body:file});
 if(!r.ok){let e=await r.text();throw Error('อัปโหลดไม่สำเร็จ: '+e)}
 return {type:file.type.startsWith('video/')?'video':'image',url:`${base}/storage/v1/object/public/media/${fileName}`};
}

// Categories are managed independently from products; existing product IDs and media remain untouched.
const demoCategoryKey = 'secondlife_demo_categories_v1';
export function demoCategories(){try{const v=JSON.parse(localStorage.getItem(demoCategoryKey)||'null');if(Array.isArray(v))return sortedCategories(v)}catch{}return DEFAULT_CATEGORIES.map(c=>({...c}));}
function setDemoCategories(items){localStorage.setItem(demoCategoryKey,JSON.stringify(items));}
export async function listCategories(admin=false){
 if(!LIVE)return sortedCategories(demoCategories().filter(c=>admin||c.is_active!==false));
 const suffix=admin?'':'&is_active=eq.true';
 const rows=await sbFetch(`/rest/v1/categories?select=*&order=sort_order.asc,slug.asc${suffix}`);
 return rows||[];
}
export async function saveCategory(category,oldSlug=null){
 const payload={slug:category.slug,name:category.name,eyebrow:category.eyebrow,headline:category.headline,emphasis:category.emphasis,tagline_th:category.tagline_th,description:category.description,banner_url:category.banner_url,theme_preset:category.theme_preset,accent_color:category.accent_color,sort_order:category.sort_order,is_active:category.is_active};
 if(!LIVE){const arr=demoCategories();const i=arr.findIndex(c=>c.slug===(oldSlug||category.slug));if(i<0)arr.push(payload);else arr[i]=payload;setDemoCategories(arr);return payload;}
 const existing=Boolean(oldSlug);
 const rows=await sbFetch(existing?`/rest/v1/categories?slug=eq.${encodeURIComponent(oldSlug)}`:'/rest/v1/categories',{method:existing?'PATCH':'POST',headers:{'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(payload)});
 return rows?.[0];
}
export async function deleteCategory(slug){
 if(!LIVE){setDemoCategories(demoCategories().filter(c=>c.slug!==slug));return;}
 await sbFetch(`/rest/v1/categories?slug=eq.${encodeURIComponent(slug)}`,{method:'DELETE'});
}
