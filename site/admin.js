import {LIVE,listProducts,listOrders,signedBankSlipUrl,reviewBankOrder,listCategories,saveProduct,deleteProduct,saveCategory,deleteCategory,uploadMedia,login,isAdmin,setSession,getSession,money,escapeHtml,safeMediaUrl} from './store-api.js';
import {DEFAULT_CATEGORIES,sortedCategories,categoryUrl,categoryArt} from './categories.js';
const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];
let products=[],categories=[],categoriesReady=false,editing=null,editorMedia=[],newFiles=[],editingCategory=null;
const toast=m=>{const t=$('#toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2900)};
function openEditor(p=null){renderCategoryOptions();editing=p;editorMedia=p?.media?structuredClone(p.media):[];newFiles=[];$('#media-files').value='';const form=$('#product-form');form.reset();const f=form.elements;f.title.value=p?.title||'';f.slug.value=p?.slug||'';f.category.value=p?.category||'watch';f.price.value=p?.price??'';f.stock.value=p?.stock??1;f.condition.value=p?.condition||'';f.description.value=p?.description||'';f.is_active.checked=p?.is_active!==false;$('#editor-title').textContent=p?'Edit product':'New product';$('#editor-error').textContent='';renderMedia();$('#admin-editor').hidden=false;document.body.style.overflow='hidden'}
function closeEditor(){$('#admin-editor').hidden=true;document.body.style.overflow=''}
function renderMedia(){let all=[...editorMedia,...newFiles.map(file=>({type:file.type.startsWith('video/')?'video':'image',url:URL.createObjectURL(file),pending:true}))];$('#editor-media').innerHTML=all.map((m,i)=>`<div class="media-tile">${m.type==='video'?`<video muted preload="metadata" src="${escapeHtml(safeMediaUrl(m.url))}"></video>`:`<img src="${escapeHtml(safeMediaUrl(m.url))}" alt="media ${i+1}">`}<button type="button" data-remove="${i}" aria-label="ลบสื่อ">×</button></div>`).join('')||'<p class="muted">ยังไม่มีสื่อ — ภาพแรกจะแสดงเป็นภาพหน้าปก</p>';$$('[data-remove]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.remove);if(i<editorMedia.length)editorMedia.splice(i,1);else newFiles.splice(i-editorMedia.length,1);renderMedia()})}
async function refresh(){products=await listProducts(true);renderCategoryList();$('#admin-product-list').innerHTML=products.map(p=>`<div class="admin-product"><img src="${escapeHtml(safeMediaUrl(p.media?.[0]?.url)||'/images/watch-gold.svg')}" alt=""><div><h3>${escapeHtml(p.title)}</h3><small>${escapeHtml(categories.find(c=>c.slug===p.category)?.name||p.category)} · ${escapeHtml(p.slug)} · ${p.is_active?'แสดง':'ซ่อน'}</small></div><strong class="price-col">${money(p.price)}</strong><span class="stock-col">STOCK ${p.stock}</span><div><button data-edit="${escapeHtml(p.id)}">EDIT</button> <button data-delete="${escapeHtml(p.id)}" aria-label="ลบ ${escapeHtml(p.title)}">×</button></div></div>`).join('')||'<div class="empty">ยังไม่มีสินค้า — กด ADD PRODUCT เพื่อเริ่ม</div>';$$('[data-edit]').forEach(b=>b.onclick=()=>openEditor(products.find(p=>String(p.id)===b.dataset.edit)));$$('[data-delete]').forEach(b=>b.onclick=async()=>{const p=products.find(p=>String(p.id)===b.dataset.delete);if(!confirm(`ลบสินค้า ${p.title}? (ถ้ามีคำสั่งซื้อ ระบบยังเก็บประวัติสินค้าในออเดอร์)`))return;try{await deleteProduct(p);await refresh();toast('ลบสินค้าแล้ว')}catch(e){toast(e.message)}})}
async function refreshOrders(){
 const el=$('#admin-order-list');
 if(!LIVE){el.innerHTML='<div class="empty">ในโหมดทดลองยังไม่มีรายการสั่งซื้อจริง</div>';return}
 try{
  const orders=await listOrders();
  el.innerHTML=orders.map(o=>{
   const isBank=o.payment_method==='bank_transfer';
   const state={awaiting_payment:'รอชำระเงิน',pending_review:'ส่งสลิปแล้ว / รอตรวจสอบ',paid:'ชำระแล้ว',cancelled:'ยกเลิก'}[o.status]||o.status;
   const canReview=isBank&&['awaiting_payment','pending_review'].includes(o.status);
   return `<div class="order-card"><header><strong>ORDER ${escapeHtml(o.id)}</strong><strong>${escapeHtml(state)}</strong></header>
    <p>${new Date(o.created_at).toLocaleString('th-TH')} · ${escapeHtml(o.customer?.name||'')} · ${escapeHtml(o.customer?.email||'')} · ${escapeHtml(o.customer?.phone||'')}</p>
    <p>รับสินค้า: ${o.delivery==='pickup'?'รับที่ร้าน':'จัดส่ง'} ${o.customer?.address?`· ${escapeHtml(o.customer.address)}`:''}</p>
    <p>สินค้า: ${(o.items||[]).map(i=>`${escapeHtml(i.title)} × ${Number(i.qty)||0}`).join(' / ')}</p>
    <strong>ยอด ${money(o.total_thb)}</strong>
    <div class="order-payment">${isBank?'PromptPay QR / ตรวจสอบเงินโอนด้วยมือ':'Stripe (ระบบเดิม)'}${o.slip_uploaded_at?`<br>ส่งสลิป: ${new Date(o.slip_uploaded_at).toLocaleString('th-TH')}`:''}${o.payment_expires_at&&o.status==='awaiting_payment'?`<br>กำหนดส่งสลิป: ${new Date(o.payment_expires_at).toLocaleString('th-TH')}`:''}</div>
    ${isBank&&o.payment_slip_path?`<div class="order-actions"><button data-bank-slip="${escapeHtml(o.id)}">ดูสลิป (ลิงก์ส่วนตัว) ↗</button></div>`:''}
    ${canReview?`<div class="order-actions">
     ${o.status==='pending_review'?`<button class="approve" data-bank-action="approve" data-bank-id="${escapeHtml(o.id)}">ยืนยันเงินเข้า / PAID</button><button data-bank-action="request_new_slip" data-bank-id="${escapeHtml(o.id)}">ขอส่งสลิปใหม่</button>`:''}
     <button data-bank-action="cancel" data-bank-id="${escapeHtml(o.id)}">ยกเลิก / คืนสต็อก</button></div>`:''}
   </div>`;
  }).join('')||'<div class="empty">ยังไม่มีคำสั่งซื้อ</div>';
  $$('[data-bank-slip]').forEach(b=>b.onclick=async()=>{
   const order=orders.find(o=>o.id===b.dataset.bankSlip);if(!order?.payment_slip_path)return;
   b.disabled=true;const tab=window.open('about:blank','_blank');
   try{const url=await signedBankSlipUrl(order.payment_slip_path);if(tab)tab.location.href=url;else toast('อนุญาตให้เปิดหน้าต่างใหม่เพื่อดูสลิปก่อน')}
   catch(e){if(tab)tab.close();toast('เปิดสลิปไม่ได้: '+e.message)}finally{b.disabled=false}
  });
  $$('[data-bank-action]').forEach(b=>b.onclick=async()=>{
   const id=b.dataset.bankId,action=b.dataset.bankAction;
   const message=action==='approve'?'ตรวจสอบจากรายการเงินเข้าธนาคารจริงแล้วใช่ไหม? กดยืนยันจะเปลี่ยนเป็น PAID':action==='cancel'?'ยกเลิกออเดอร์และคืนจำนวนสต็อกใช่ไหม?':'ขอให้ลูกค้าส่งสลิปใหม่ใช่ไหม?';
   if(!confirm(message))return;
   b.disabled=true;
   try{await reviewBankOrder(id,action);toast('อัปเดตคำสั่งซื้อแล้ว');await refreshOrders()}
   catch(e){toast('เปลี่ยนสถานะไม่สำเร็จ: '+e.message);b.disabled=false}
  });
 }catch(e){el.innerHTML=`<div class="error">${escapeHtml(e.message)}</div>`}
}
async function signIn(e){e.preventDefault();const f=new FormData(e.currentTarget);$('#login-error').textContent='';try{await login(String(f.get('email')),String(f.get('password')));await showWorkspace()}catch(ex){$('#login-error').textContent=ex.message}}
async function showWorkspace(){$('#admin-login').hidden=true;$('#admin-workspace').hidden=false;$('#logout').hidden=!LIVE;await loadCategories();await refresh()}
async function save(e){e.preventDefault();const btn=$('#save-product');const err=$('#editor-error');err.textContent='';btn.disabled=true;btn.textContent='SAVING...';try{const f=new FormData(e.currentTarget);const title=String(f.get('title')).trim();const slug=String(f.get('slug')).trim();const price=Number(f.get('price'));const stock=Number(f.get('stock'));if(!title||!slug||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))throw Error('กรอกชื่อและ slug ภาษาอังกฤษตัวเล็กคั่นด้วย -');if(!Number.isSafeInteger(price)||price<0||!Number.isSafeInteger(stock)||stock<0)throw Error('ราคาและสต็อกต้องเป็นเลขจำนวนเต็มไม่ติดลบ');let media=[...editorMedia];for(const file of newFiles){const item=await uploadMedia(file);media.push(item)}const product={...(editing||{}),id:editing?.id||(LIVE?undefined:`demo-${Date.now()}`),title,slug,category:String(f.get('category')),price,stock,condition:String(f.get('condition')||''),description:String(f.get('description')||''),media,is_active:f.has('is_active')};if(!product.media.length)throw Error('โปรดใส่ภาพอย่างน้อย 1 ภาพ');await saveProduct(product);closeEditor();await refresh();toast('บันทึกสินค้าเรียบร้อย')}catch(ex){err.textContent=ex.message}finally{btn.disabled=false;btn.textContent='SAVE PRODUCT ↗'}}
function renderCategoryOptions(){
 const select=$('#product-form [name="category"]');const previous=select.value;
 const arr=sortedCategories(categories).filter(c=>c.is_active!==false||products.some(p=>p.category===c.slug));
 select.innerHTML=arr.map(c=>`<option value="${escapeHtml(c.slug)}">${escapeHtml(c.name)}</option>`).join('');
 if(arr.some(c=>c.slug===previous))select.value=previous;
}
async function loadCategories(){
 try{categories=await listCategories(true);categoriesReady=true;$('#category-migration-note').hidden=true}
 catch(e){categories=DEFAULT_CATEGORIES.map(c=>({...c}));categoriesReady=!LIVE;
   $('#category-migration-note').hidden=false;
   $('#category-migration-note').textContent='ยังไม่ได้รันไฟล์ MIGRATION_001_CATEGORIES.sql ใน Supabase — หน้าเว็บแสดงหมวดพื้นฐานได้ แต่การเพิ่ม/แก้ไขหมวดจะใช้ไม่ได้จนกว่าจะรัน SQL ('+e.message+')';}
 renderCategoryOptions();renderCategoryList();
}
function renderCategoryList(){
 const el=$('#admin-category-list');if(!el)return;
 el.innerHTML=sortedCategories(categories).map(c=>{
   const productsCount=products.filter(p=>p.category===c.slug).length;
   const cover=safeMediaUrl(c.banner_url)||categoryArt(c);
   return `<div class="admin-category"><img src="${escapeHtml(cover)}" alt=""><div><h3>${escapeHtml(c.name)}</h3><p class="muted">/${escapeHtml(c.slug)} · ${escapeHtml(c.theme_preset)} · ลำดับ ${c.sort_order} · ${c.is_active?'แสดง':'ซ่อน'} · ${productsCount} สินค้า</p><a href="${categoryUrl(c.slug)}" target="_blank" rel="noopener">ดูหมวด ↗</a></div><div class="category-actions"><button data-category-edit="${escapeHtml(c.slug)}">EDIT</button><button data-category-remove="${escapeHtml(c.slug)}" ${productsCount?'disabled title="ย้ายสินค้าก่อนลบหมวด"':''}>DELETE</button></div></div>`;
 }).join('')||'<div class="empty">ยังไม่มีหมวดสินค้า</div>';
 $$('[data-category-edit]').forEach(b=>b.onclick=()=>openCategoryEditor(categories.find(c=>c.slug===b.dataset.categoryEdit)));
 $$('[data-category-remove]').forEach(b=>b.onclick=async()=>{
   if(!categoriesReady){toast('โปรดรันไฟล์ Migration ก่อน');return}
   const slug=b.dataset.categoryRemove;if(!confirm(`ลบหมวด ${slug} อย่างถาวร?`))return;
   try{await deleteCategory(slug);await loadCategories();toast('ลบหมวดแล้ว')}
   catch(e){toast('ลบหมวดไม่ได้: '+e.message)}
 });
}
function openCategoryEditor(c=null){
 if(!categoriesReady){toast('โปรดรันไฟล์ MIGRATION_001_CATEGORIES.sql ก่อน');return}
 editingCategory=c;const form=$('#category-form');form.reset();
 const f=form.elements;
 for(const name of ['slug','name','eyebrow','headline','emphasis','tagline_th','description','theme_preset','accent_color','sort_order']){
  if(c && c[name]!==undefined)f[name].value=c[name];
 }
 if(!c){f.sort_order.value=categories.length*10+10;f.accent_color.value='#967449';f.theme_preset.value='watch'}
 f.slug.readOnly=Boolean(c);f.is_active.checked=c?.is_active!==false;
 $('#category-editor-title').textContent=c?'Edit collection':'New collection';
 $('#category-banner-file').value='';$('#category-editor-error').textContent='';renderCategoryPreview();
 $('#category-editor').hidden=false;document.body.style.overflow='hidden';
}
function renderCategoryPreview(){
 const el=$('#category-banner-preview');const c=editingCategory;
 const src=safeMediaUrl(c?.banner_url);
 el.innerHTML=src?`<img src="${escapeHtml(src)}" alt="ปกหมวด"><span>ภาพแบนเนอร์ปัจจุบัน — เลือกไฟล์ใหม่เพื่อแทนที่</span>`:'ภาพแบนเนอร์: ใช้ภาพสินค้าจริงในหมวดอัตโนมัติ ถ้าไม่ได้อัปโหลด';
}
function closeCategoryEditor(){$('#category-editor').hidden=true;document.body.style.overflow=''}
async function submitCategory(e){
 e.preventDefault();const btn=$('#save-category');const err=$('#category-editor-error');err.textContent='';
 if(!categoriesReady){err.textContent='โปรดรัน Migration ก่อน';return}
 btn.disabled=true;btn.textContent='SAVING...';
 try{
  const f=new FormData(e.currentTarget);const slug=String(f.get('slug')||'').trim().toLowerCase();
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))throw Error('URL slug ต้องเป็นภาษาอังกฤษตัวเล็ก คั่นด้วย -');
  let banner_url=editingCategory?.banner_url||'';
  const file=$('#category-banner-file').files?.[0];
  if(file){if(!file.type.startsWith('image/'))throw Error('ปกหมวดต้องเป็นรูปภาพเท่านั้น');const uploaded=await uploadMedia(file);banner_url=uploaded.url}
  const payload={slug,name:String(f.get('name')||'').trim(),eyebrow:String(f.get('eyebrow')||'').trim(),headline:String(f.get('headline')||'').trim(),emphasis:String(f.get('emphasis')||'').trim(),tagline_th:String(f.get('tagline_th')||'').trim(),description:String(f.get('description')||'').trim(),theme_preset:String(f.get('theme_preset')||'watch'),accent_color:String(f.get('accent_color')||'#967449'),sort_order:Number(f.get('sort_order')||100),banner_url,is_active:f.has('is_active')};
  if(!payload.name)throw Error('กรุณากรอกชื่อหมวด');
  if(!Number.isSafeInteger(payload.sort_order))throw Error('ลำดับต้องเป็นจำนวนเต็ม');
  await saveCategory(payload,editingCategory?.slug||null);
  closeCategoryEditor();await loadCategories();toast('บันทึกหมวดสินค้าเรียบร้อย');
 }catch(ex){err.textContent=ex.message}finally{btn.disabled=false;btn.textContent='SAVE CATEGORY ↗'}
}
async function init(){
 if(!LIVE){$('#admin-demo').hidden=false;await showWorkspace()}
 else if(await isAdmin()){await showWorkspace()}
 else{$('#admin-login').hidden=false}
 $('#login-form').onsubmit=signIn;
 $('#logout').onclick=()=>{setSession(null);location.reload()};
 $('#add-product').onclick=()=>openEditor();
 $('#editor-close').onclick=closeEditor;
 $('#product-form').onsubmit=save;
 $('#media-files').onchange=e=>{newFiles.push(...[...e.target.files]);renderMedia()};
 $('#add-category').onclick=()=>openCategoryEditor();
 $('#category-editor-close').onclick=closeCategoryEditor;
 $('#category-form').onsubmit=submitCategory;
 $('#category-banner-file').onchange=e=>{const file=e.target.files?.[0];const el=$('#category-banner-preview');if(file){el.innerHTML='';const img=document.createElement('img');img.alt='ภาพที่เลือก';img.src=URL.createObjectURL(file);el.append(img)}};
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeEditor();closeCategoryEditor()}});
 let slugTouched=false;
 $('#product-form [name="slug"]').addEventListener('input',()=>slugTouched=true);
 $('#product-form [name="title"]').addEventListener('input',e=>{if(editing||slugTouched)return;const ascii=e.target.value.toLowerCase().normalize('NFD').replace(/[^a-z0-9\s-]/g,'').trim().replace(/\s+/g,'-').replace(/-+/g,'-');$('#product-form [name="slug"]').value=ascii||`item-${Date.now().toString(36)}`});
 $$('[data-admin-tab]').forEach(b=>b.onclick=async()=>{
   $$('[data-admin-tab]').forEach(x=>x.classList.toggle('active',x===b));
   $('#admin-products').hidden=b.dataset.adminTab!=='products';
   $('#admin-orders').hidden=b.dataset.adminTab!=='orders';
   $('#admin-categories').hidden=b.dataset.adminTab!=='categories';
   if(b.dataset.adminTab==='orders')await refreshOrders();
   if(b.dataset.adminTab==='categories'){await loadCategories();renderCategoryList()}
 });
}
init().catch(e=>{$('#login-error').textContent=e.message;toast(e.message)});
