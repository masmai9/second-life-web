import { randomBytes,createHash } from 'node:crypto';
import QRCode from 'qrcode';
import { reply,rpc,supaRequest } from '../lib/_utils.mjs';
import { promptpayPayload } from '../lib/promptpay.mjs';

export const handler = async event => {
 if(event.httpMethod!=='POST')return reply(405,{error:'Method not allowed'});
 if(!process.env.SUPABASE_SERVICE_ROLE_KEY||!process.env.SUPABASE_URL)return reply(503,{error:'ร้านยังไม่ได้เชื่อมระบบคำสั่งซื้อ'});
 if(!process.env.PROMPTPAY_ID)return reply(503,{error:'ร้านยังไม่ได้ตั้งค่า PROMPTPAY_ID บน Netlify'});
 let reserved=null;
 try{
  // Reject invalid PromptPay account before locking inventory.
  promptpayPayload(process.env.PROMPTPAY_ID,1);
  const data=JSON.parse(event.body||'{}');
  if(!Array.isArray(data.items)||data.items.length<1||data.items.length>15)throw Error('ตะกร้าสินค้าไม่ถูกต้อง');
  const items=data.items.map(i=>({id:String(i.id||''),qty:Number(i.qty)}));
  if(items.some(i=>!/^[a-f0-9-]{36}$/i.test(i.id)||!Number.isInteger(i.qty)||i.qty<1||i.qty>20))throw Error('จำนวนสินค้าหรือรหัสสินค้าไม่ถูกต้อง');
  const c=data.customer||{};
  const customer={name:String(c.name||'').trim().slice(0,120),email:String(c.email||'').trim().toLowerCase().slice(0,200),phone:String(c.phone||'').trim().slice(0,30),address:String(c.address||'').trim().slice(0,500)};
  if(customer.name.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)||!/^0\d{8,9}$/.test(customer.phone.replace(/[\s-]/g,'')))throw Error('กรุณากรอกชื่อ อีเมล และเบอร์โทรให้ถูกต้อง');
  const delivery=data.delivery==='shipping'?'shipping':'pickup';
  if(delivery==='shipping'&&customer.address.length<15)throw Error('กรุณากรอกที่อยู่จัดส่งให้ครบ');
  const feeEnv=process.env.DELIVERY_FEE_THB;
  if(delivery==='shipping'&&(!feeEnv||!/^\d+$/.test(feeEnv)))throw Error('ร้านยังไม่ได้ตั้งค่าจัดส่ง โปรดเลือกมารับที่ร้านก่อน');
  const shippingFee=delivery==='shipping'?Number(feeEnv):0;
  if(!Number.isInteger(shippingFee)||shippingFee<0||shippingFee>100000)throw Error('ค่าจัดส่งไม่ถูกต้อง');
  // Reap expired unpaid reservations whenever someone checks out.
  await rpc('expire_bank_transfers',{});
  reserved=await rpc('reserve_order',{p_items:items,p_customer:customer,p_delivery:delivery,p_shipping_fee:shippingFee});
  if(!reserved?.order_id)throw Error('ไม่สามารถสร้างคำสั่งซื้อ');
  const expires=new Date(Date.now()+120*60*1000).toISOString();
  const token=randomBytes(32).toString('hex');
  const hash=createHash('sha256').update(token).digest('hex');
  const rows=await supaRequest(`orders?id=eq.${reserved.order_id}`,{
    method:'PATCH',headers:{Prefer:'return=representation'},
    body:JSON.stringify({payment_method:'bank_transfer',payment_token_hash:hash,payment_expires_at:expires})
  });
  if(!rows?.length)throw Error('ไม่สามารถตั้งค่าการชำระเงิน');
  const payload=promptpayPayload(process.env.PROMPTPAY_ID,reserved.total_thb);
  const qrPng=await QRCode.toDataURL(payload,{errorCorrectionLevel:'M',margin:4,width:480});
  return reply(200,{order_id:reserved.order_id,total_thb:reserved.total_thb,shipping_thb:shippingFee,
    expires_at:expires,token,qr_png:qrPng,receiver_name:String(process.env.PROMPTPAY_NAME||'').slice(0,100)});
 }catch(error){
  if(reserved?.order_id){try{await rpc('release_order',{p_order_id:reserved.order_id})}catch(ex){console.error('Failed to release failed order:',ex)}}
  console.error('Bank order error:',error.message);
  return reply(400,{error:error.message.startsWith('Database error:')?'สินค้าอาจหมด หรือยังไม่ได้รัน Migration 002 กรุณาตรวจสอบหลังร้าน':error.message});
 }
};
