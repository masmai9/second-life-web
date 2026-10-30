import {LIVE,listProducts,listCategories,money,escapeHtml,safeMediaUrl} from './store-api.js';
import {DEFAULT_CATEGORIES,sortedCategories,categoryUrl,categoryArt,validColor} from './categories.js';
const cfg=window.SECONDLIFE_CONFIG || {};
const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];
let products=[],categories=[],currentCategory=null,filter='all',search='',sort='featured',selected=null,thumbIndex=0;
let cart=(()=>{try{return JSON.parse(localStorage.getItem('secondlife_cart')||'{}')}catch{return{}}})();
const toast=(msg)=>{const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>el.classList.remove('show'),3200)};
const saveCart=()=>{localStorage.setItem('secondlife_cart',JSON.stringify(cart));updateCart()};
const collection=()=>products.filter(p=>p.category===currentCategory);
const pathFor=p=>`/products/${encodeURIComponent(p.slug)}`;
function mediaEl(m,alt,cls=''){const src=safeMediaUrl(m?.url)||'/images/watch-gold.svg';return m?.type==='video'?`<video class="${cls}" controls playsinline preload="metadata" src="${escapeHtml(src)}"></video>`:`<img class="${cls}" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy">`}
function renderProducts(){let shown=collection().filter(p=>filter!=='available'||p.stock>0).filter(p=>`${p.title} ${p.description||''}`.toLowerCase().includes(search));if(sort==='price-asc')shown.sort((a,b)=>a.price-b.price);if(sort==='price-desc')shown.sort((a,b)=>b.price-a.price);$('#products-total').textContent=`${shown.length} SELECTED PIECES`;$('#product-grid').innerHTML=shown.map(p=>`<article class="product" data-id="${escapeHtml(p.id)}" tabindex="0" role="button" aria-label="ดู ${escapeHtml(p.title)}"><div class="product-image">${mediaEl(p.media?.[0],p.title)}<span class="product-badge">${escapeHtml(p.stock>0?(p.badge||'SECOND LIFE'):'SOLD OUT')}</span><span class="product-icon">↗</span></div><div class="product-meta"><span>${escapeHtml(categories.find(c=>c.slug===p.category)?.name || p.category.toUpperCase())}</span><span>${p.stock>0?'AVAILABLE':'SOLD OUT'}</span></div><div class="product-info"><h3>${escapeHtml(p.title)}</h3><span class="price">${money(p.price)}</span></div><p class="condition">${escapeHtml(p.condition||'รายละเอียดสินค้า')}</p></article>`).join('')||'<div class="empty">ไม่พบสินค้าที่ค้นหา</div>';
 $$('.product').forEach(el=>{const open=()=>openDetail(products.find(p=>String(p.id)===el.dataset.id));el.onclick=open;el.onkeydown=e=>{if(e.key==='Enter')open()}})
}
function categoryBySlug(slug){return categories.find(c=>c.slug===slug && c.is_active!==false);}
function displayArt(c){
 const candidate=products.find(p=>p.category===c.slug && p.media?.some(m=>m.type==='image'));
 return safeMediaUrl(c.banner_url) || safeMediaUrl(candidate?.media?.find(m=>m.type==='image')?.url) || categoryArt(c);
}
function renderHome(){
 const items=sortedCategories(categories.filter(c=>c.is_active!==false));
 $('#mode-grid').innerHTML=items.map((c,i)=>{
   const count=products.filter(p=>p.category===c.slug).length;
   return `<a class="mode-card mode-${escapeHtml(c.theme_preset)}" href="${categoryUrl(c.slug)}" data-go-category="${escapeHtml(c.slug)}" aria-label="ดูหมวด ${escapeHtml(c.name)}">
     <img class="mode-card-image" src="${escapeHtml(displayArt(c))}" alt="${escapeHtml(c.name)}" loading="${i===0?'eager':'lazy'}">
     <span class="mode-card-shade"></span><span class="mode-card-top"><span>0${i+1} / SECOND LIFE</span><span>EXPLORE ↗</span></span>
     <span class="mode-card-copy"><span class="mode-card-kicker">${escapeHtml(c.eyebrow || 'THE COLLECTION')}</span>
     <strong>${escapeHtml(c.name)}</strong><span class="mode-card-thai">${escapeHtml(c.tagline_th || c.description)}</span>
     <span class="mode-card-bottom">${count ? `${count} SELECTED PIECES` : 'DISCOVER THE COLLECTION'} <span class="mode-card-arrow">↗</span></span></span>
    </a>`;
 }).join('')||'<p class="empty">ยังไม่มีหมวดสินค้าที่เปิดแสดง</p>';
}
function renderNav(){
 $('#nav-categories').innerHTML=sortedCategories(categories.filter(c=>c.is_active!==false)).map(c=>`<a href="${categoryUrl(c.slug)}" class="nav-button ${currentCategory===c.slug?'selected':''}" data-go-category="${escapeHtml(c.slug)}">${escapeHtml(c.name)}</a>`).join('');
 $('.nav-home').classList.toggle('selected',!currentCategory);
}
function navigateCategory(slug=null,push=true){
 const cat=categoryBySlug(slug);currentCategory=cat?.slug||null;
 if(push)history.pushState({category:currentCategory},'',categoryUrl(currentCategory));
 $('#mode-home').hidden=Boolean(cat);
 $('#top').hidden=!cat;
 $('#category-values').hidden=!cat;
 $('#collection').hidden=!cat;
 document.body.classList.remove('theme-watch','theme-music','theme-tech','theme-home');
 document.body.style.removeProperty('--accent');
 document.body.classList.add(cat?`theme-${['watch','music','tech'].includes(cat.theme_preset)?cat.theme_preset:'watch'}`:'theme-home');
 if(cat){
   document.body.style.setProperty('--accent',validColor(cat.accent_color));
   $('#hero-eyebrow').textContent=cat.eyebrow || 'SECOND LIFE / CURATED FINDS';
   $('#hero-title').innerHTML=`${escapeHtml(cat.headline || cat.name)}<br><i>${escapeHtml(cat.emphasis||'curated for you.')}</i>`;
   $('#hero-thai').textContent=cat.tagline_th||'';
   $('#hero-desc').textContent=cat.description||'';
   $('#hero-img').src=displayArt(cat);
   $('#hero-img').alt=cat.name;
   $('#collection-kicker').textContent=cat.eyebrow||cat.name;
   $('#collection-title').innerHTML=`${escapeHtml(cat.headline||cat.name)} <i>${escapeHtml(cat.emphasis||'collection.')}</i>`;
   $('#collection-description').textContent=cat.tagline_th||'';
 }else{renderHome();}
 search='';filter='all';$('#search').value='';$('#sort').value='featured';sort='featured';
 $$('.filter').forEach(b=>b.classList.toggle('active',b.dataset.filter==='all'));
 renderNav();if(cat)renderProducts();
 document.title=(cat?`${cat.name} | `:'')+'Second Life — Curated finds, new stories';
}
function overlay(show){$('#overlay').hidden=!show;if(!show){$('#cart-drawer').classList.remove('open');$('#cart-drawer').setAttribute('aria-hidden','true');$('#detail-modal').hidden=true;$('#checkout-modal').hidden=true;document.body.style.overflow=''}else document.body.style.overflow='hidden'}
function openCart(){updateCart();overlay(true);$('#cart-drawer').classList.add('open');$('#cart-drawer').setAttribute('aria-hidden','false')}
function openDetail(p,push=true){if(!p)return;selected=p;thumbIndex=0;renderDetail();overlay(true);$('#detail-modal').hidden=false;if(push)history.pushState({product:p.slug,category:p.category},'',pathFor(p))}
function closeAll(){const wasDetail=!$('#detail-modal').hidden;overlay(false);if(wasDetail&&(location.pathname.startsWith('/products/') || new URLSearchParams(location.search).has('product'))){history.replaceState({category:selected?.category||currentCategory},'',categoryUrl(selected?.category||currentCategory));navigateCategory(selected?.category||currentCategory,false)}}
function renderDetail(){const p=selected;if(!p)return;const m=p.media?.[thumbIndex]||p.media?.[0];$('#detail-content').innerHTML=`<div class="detail-layout"><div class="detail-visual"><div class="detail-featured">${mediaEl(m,p.title)}</div><div class="thumbs">${(p.media||[]).map((im,i)=>`<button aria-label="ดูสื่อ ${i+1}" data-thumb="${i}" class="${i===thumbIndex?'active':''}">${im.type==='video'?'<span class="thumb-video">▶ VIDEO</span>':mediaEl(im,p.title)}</button>`).join('')}</div></div><div class="detail-text"><span class="eyebrow">${escapeHtml(categories.find(c=>c.slug===p.category)?.eyebrow || 'SECOND LIFE COLLECTION')}</span><h2>${escapeHtml(p.title)}</h2><div class="detail-price">${money(p.price)}</div><p class="detail-desc">${escapeHtml(p.description||'สนใจชิ้นนี้? ติดต่อเราเพื่อสอบถามรายละเอียดเพิ่มเติม')}</p><div class="detail-condition">CONDITION <b>${escapeHtml(p.condition||'-')}</b></div><p class="muted">${p.stock>0?`พร้อมจำหน่าย · จำนวน ${p.stock} ชิ้น`:'สินค้าหมดชั่วคราว'}</p><button class="btn btn-primary wide" id="detail-add" ${p.stock<1?'disabled':''}>${p.stock>0?'ADD TO BAG ↗':'SOLD OUT'}</button><p class="muted" style="margin-top:20px;font-size:11px">ภาพและวิดีโอจริงของสินค้าสามารถอัปโหลดได้จากหลังร้าน</p></div></div>`;
 $$('[data-thumb]').forEach(el=>el.onclick=()=>{thumbIndex=Number(el.dataset.thumb);renderDetail()});$('#detail-add').onclick=()=>{addToCart(p.id);overlay(false);openCart()}}
function getItems(){return Object.entries(cart).map(([id,qty])=>({p:products.find(p=>String(p.id)===id),qty})).filter(x=>x.p&&x.qty>0)}
function addToCart(id){const p=products.find(p=>String(p.id)===String(id));if(!p||p.stock<1){toast('สินค้าหมด');return}cart[id]=Math.min(p.stock,(cart[id]||0)+1);saveCart();toast('เพิ่มสินค้าลงตะกร้าแล้ว')}
function updateCart(){let qty=0,sum=0;const items=getItems();for(const {p,qty:q} of items){qty+=q;sum+=p.price*q}$('#cart-count').textContent=qty;$('#drawer-count').textContent=`(${qty})`;$('#cart-subtotal').textContent=money(sum);$('#cart-items').innerHTML=items.map(({p,qty})=>`<div class="cart-item"><img src="${escapeHtml(safeMediaUrl(p.media?.[0]?.url)||'/images/watch-gold.svg')}" alt="${escapeHtml(p.title)}"><div><h3>${escapeHtml(p.title)}</h3><small>${escapeHtml(p.condition||'')}</small><div class="qty-actions"><button data-qty="-1" data-id="${escapeHtml(p.id)}" aria-label="ลดจำนวน">−</button>${qty}<button data-qty="1" data-id="${escapeHtml(p.id)}" aria-label="เพิ่มจำนวน">+</button></div></div><strong>${money(p.price*qty)}</strong></div>`).join('')||'<div class="empty">ยังไม่มีสินค้าในตะกร้า</div>';$('#begin-checkout').disabled=!items.length;$$('[data-qty]').forEach(b=>b.onclick=()=>{const id=b.dataset.id;const p=products.find(p=>String(p.id)===id);cart[id]=Math.min(p.stock,Math.max(0,(cart[id]||0)+Number(b.dataset.qty)));if(!cart[id])delete cart[id];saveCart()})}
function checkout(){const items=getItems();if(!items.length)return;overlay(true);$('#checkout-modal').hidden=false;$('#checkout-error').textContent='';$('#checkout-review').innerHTML=items.map(({p,qty})=>`<div><span>${escapeHtml(p.title)} × ${qty}</span><strong>${money(p.price*qty)}</strong></div>`).join('')+`<div style="font-weight:700;border-top:1px solid var(--line);margin-top:10px;padding-top:10px"><span>ยอดสินค้า (ไม่รวมค่าจัดส่ง)</span><strong>${money(items.reduce((s,{p,qty})=>s+p.price*qty,0))}</strong></div>`}
async function submitCheckout(e){e.preventDefault();const form=e.currentTarget;const fd=new FormData(form);const err=$('#checkout-error');const btn=$('#pay-button');err.textContent='';if(!LIVE){err.textContent='นี่เป็นโหมดทดลอง ยังไม่สามารถรับเงินจริงได้ ต้องเชื่อม Supabase และ Stripe ก่อน';return}btn.disabled=true;btn.textContent='กำลังสร้างคำสั่งซื้อ...';try{const items=getItems().map(({p,qty})=>({id:p.id,qty}));const r=await fetch('/.netlify/functions/create-checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items,customer:{name:fd.get('name'),email:fd.get('email'),phone:fd.get('phone'),address:fd.get('address')},delivery:fd.get('delivery')})});const out=await r.json();if(!r.ok)throw Error(out.error||'ไม่สามารถเริ่มชำระเงินได้');if(!out.url||!out.url.startsWith('https://checkout.stripe.com/'))throw Error('ลิงก์จ่ายเงินไม่ถูกต้อง');window.location.assign(out.url)}catch(ex){err.textContent=ex.message;btn.disabled=false;btn.textContent='CONTINUE TO SECURE PAYMENT ↗'}}
async function init(){
 if(!LIVE)$('#mode-notice').textContent='โหมดต้นแบบ: สินค้าและราคาเป็นตัวอย่าง ยังไม่เปิดรับชำระเงินจริง';
 else $('#mode-notice').textContent='โปรดตรวจสอบรายละเอียดสินค้าและเงื่อนไขก่อนสั่งซื้อ';
 if(cfg.lineUrl?.startsWith('https://')){$('#line-link').hidden=false;$('#line-link').href=cfg.lineUrl}
 if(cfg.mapUrl?.startsWith('https://')){$('#map-link').hidden=false;$('#map-link').href=cfg.mapUrl}
 if(cfg.phone)$('#visit-contact').textContent=`ติดต่อร้าน: ${cfg.phone}`;
 try{products=await listProducts();if(!products.length)toast('ยังไม่มีสินค้าในระบบ กรุณาเพิ่มจากหลังร้าน')}catch(e){toast(e.message);products=[]}
 try{categories=await listCategories();}catch(e){console.warn('Categories migration may not be applied yet',e);categories=DEFAULT_CATEGORIES;toast('ยังไม่ได้เปิดระบบหมวดใหม่: แสดงหมวดพื้นฐานก่อน');}
 navigateCategory(new URLSearchParams(location.search).get('category'),false);updateCart();
 const slug=location.pathname.match(/^\/products\/([^/]+)/)?.[1] || new URLSearchParams(location.search).get('product');
 if(slug){let p;try{p=products.find(x=>x.slug===decodeURIComponent(slug))}catch{}if(p){navigateCategory(p.category,false);openDetail(p,false)}}
 document.addEventListener('click',e=>{
  const a=e.target.closest('a[data-go-category],.nav-home,.back-categories');
  if(!a||e.defaultPrevented||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
  e.preventDefault();overlay(false);navigateCategory(a.dataset.goCategory||null,true);scrollTo({top:0,behavior:'instant'});
 });
 $('#music-cta').onclick=()=>{navigateCategory('music',true);$('#collection').scrollIntoView({behavior:'smooth'})};
 $$('.filter').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;$$('.filter').forEach(x=>x.classList.toggle('active',x===b));renderProducts()});
 $('#search').oninput=e=>{search=e.target.value.toLowerCase().trim();renderProducts()};
 $('#search-toggle').onclick=()=>{if(!currentCategory){const first=categories.find(c=>c.is_active!==false);if(first)navigateCategory(first.slug,true)}$('#collection').scrollIntoView();$('#search').focus()};
 $('#sort').onchange=e=>{sort=e.target.value;renderProducts()};
 $('#cart-open').onclick=openCart;$('#overlay').onclick=closeAll;
 $$('[data-close]').forEach(b=>b.onclick=closeAll);
 document.addEventListener('keydown',e=>{if(e.key==='Escape')closeAll()});
 $('#begin-checkout').onclick=checkout;
 $('#delivery-select').onchange=e=>{const ship=e.target.value==='shipping';$('#address-label').hidden=!ship;$('#address-label textarea').required=ship};
 $('#checkout-form').onsubmit=submitCheckout;
 window.onpopstate=()=>{
  const path=location.pathname.match(/^\/products\/([^/]+)/)?.[1];
  const params=new URLSearchParams(location.search);
  const slug=path || params.get('product');let p;
  try{p=products.find(x=>x.slug===decodeURIComponent(slug||''))}catch{}
  if(p){navigateCategory(p.category,false);openDetail(p,false)}
  else{overlay(false);navigateCategory(params.get('category'),false)}
 };
 if(new URLSearchParams(location.search).has('cancelled'))toast('ยกเลิกการชำระเงินแล้ว สามารถกลับไปเลือกสินค้าใหม่ได้');
}
init().catch(err=>{console.error(err);toast('ไม่สามารถเริ่มเว็บไซต์ได้: '+err.message)});
