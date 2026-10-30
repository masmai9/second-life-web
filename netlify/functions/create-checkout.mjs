import {reply,rpc,siteOrigin} from '../lib/_utils.mjs';
export const handler=async(event)=>{
 if(event.httpMethod!=='POST')return reply(405,{error:'Method not allowed'});
 const key=process.env.STRIPE_SECRET_KEY;
 if(!key||!process.env.SUPABASE_SERVICE_ROLE_KEY)return reply(503,{error:'ระบบชำระเงินยังไม่เปิดใช้งาน'});
 let reserved=null,hasStripeSession=false;
 try{
   const data=JSON.parse(event.body||'{}');
   if(!Array.isArray(data.items)||data.items.length<1||data.items.length>15)throw Error('ตะกร้าสินค้าไม่ถูกต้อง');
   const items=data.items.map(i=>({id:String(i.id||''),qty:Number(i.qty)}));
   if(items.some(i=>!/^[a-f0-9-]{36}$/i.test(i.id)||!Number.isInteger(i.qty)||i.qty<1||i.qty>20))throw Error('จำนวนสินค้าหรือรหัสสินค้าไม่ถูกต้อง');
   const c=data.customer||{};
   const customer={name:String(c.name||'').trim().slice(0,120),email:String(c.email||'').trim().toLowerCase().slice(0,200),phone:String(c.phone||'').trim().slice(0,30),address:String(c.address||'').trim().slice(0,500)};
   if(customer.name.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)||customer.phone.length<8)throw Error('กรุณากรอกข้อมูลผู้สั่งซื้อให้ครบ');
   const delivery=data.delivery==='shipping'?'shipping':'pickup';
   if(delivery==='shipping'&&customer.address.length<15)throw Error('กรุณากรอกที่อยู่จัดส่งให้ครบ');
   const feeEnv=process.env.DELIVERY_FEE_THB;
   if(delivery==='shipping'&&(!feeEnv||!/^[0-9]+$/.test(feeEnv)))throw Error('ร้านยังไม่ได้ตั้งค่าจัดส่ง โปรดเลือกมารับที่ร้านก่อน');
   const shippingFee=delivery==='shipping'?Number(feeEnv):0;
   if(!Number.isInteger(shippingFee)||shippingFee<0||shippingFee>100000)throw Error('ค่าจัดส่งไม่ถูกต้อง');
   reserved=await rpc('reserve_order',{p_items:items,p_customer:customer,p_delivery:delivery,p_shipping_fee:shippingFee});
   if(!reserved||!reserved.order_id)throw Error('ไม่สามารถสร้างคำสั่งซื้อได้');
   const base=siteOrigin(event.headers);if(!/^https:\/\//.test(base))throw Error('โปรดตั้งค่า SITE_URL หรือ URL เป็น https');
   const body=new URLSearchParams();body.set('mode','payment');body.set('customer_email',customer.email);body.set('client_reference_id',reserved.order_id);body.set('metadata[order_id]',reserved.order_id);body.set('success_url',`${base}/checkout-success.html?order=${reserved.order_id}&session_id={CHECKOUT_SESSION_ID}`);body.set('cancel_url',`${base}/?cancelled=1`);body.set('expires_at',String(Math.floor(Date.now()/1000)+1800));
   // Dynamic payment methods: enable Card and PromptPay in Stripe Dashboard.
   // API versions from 2026-09-30 onward reject payment_method_types on Checkout creation.
   let ix=0;for(const item of reserved.items){body.set(`line_items[${ix}][price_data][currency]`,'thb');body.set(`line_items[${ix}][price_data][unit_amount]`,String(item.price*100));body.set(`line_items[${ix}][price_data][product_data][name]`,String(item.title).slice(0,200));body.set(`line_items[${ix}][quantity]`,String(item.qty));ix++}
   if(shippingFee>0){body.set(`line_items[${ix}][price_data][currency]`,'thb');body.set(`line_items[${ix}][price_data][unit_amount]`,String(shippingFee*100));body.set(`line_items[${ix}][price_data][product_data][name]`,'ค่าจัดส่ง');body.set(`line_items[${ix}][quantity]`,'1')}
   const stripe=await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{authorization:`Bearer ${key}`,'content-type':'application/x-www-form-urlencoded','Idempotency-Key':`sl-${reserved.order_id}`},body:body.toString()});
   const session=await stripe.json();if(!stripe.ok||!session.id||!session.url)throw Error('Stripe: '+(session.error?.message||'สร้างหน้าชำระเงินไม่สำเร็จ'));
   hasStripeSession=true;
   await rpc('attach_session',{p_order_id:reserved.order_id,p_session_id:session.id});
   return reply(200,{url:session.url,order_id:reserved.order_id});
 }catch(ex){
   // Do not release after Stripe session creation: user could still pay the open session.
   if(reserved?.order_id && !hasStripeSession){try{await rpc('release_order',{p_order_id:reserved.order_id})}catch(e){console.error('Release failed',e)}}
   console.error('Checkout failed:',ex.message);
   const friendly=ex.message.includes('Database error:')?'สินค้าอาจหมดหรือไม่พร้อมจำหน่าย กรุณารีเฟรชหน้าเว็บ':ex.message;
   return reply(400,{error:friendly});
 }
};
