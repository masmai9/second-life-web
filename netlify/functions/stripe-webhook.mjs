import crypto from 'node:crypto';
import {rpc} from '../lib/_utils.mjs';
const validSignature=(raw,header,key)=>{
 const pairs=Object.fromEntries(String(header||'').split(',').map(v=>v.split('=',2)));const time=Number(pairs.t);
 if(!time||Math.abs(Date.now()/1000-time)>300)return false;
 const want=crypto.createHmac('sha256',key).update(`${time}.${raw}`,'utf8').digest('hex');
 return String(header).split(',').filter(x=>x.startsWith('v1=')).some(x=>{const got=x.slice(3);return /^[a-f0-9]{64}$/i.test(got)&&got.length===want.length&&crypto.timingSafeEqual(Buffer.from(got,'hex'),Buffer.from(want,'hex'))});
};
export const handler=async event=>{
 if(event.httpMethod!=='POST')return {statusCode:405,body:'Method not allowed'};
 const key=process.env.STRIPE_WEBHOOK_SECRET;
 if(!key)return {statusCode:503,body:'Webhook secret missing'};
 const raw=event.isBase64Encoded?Buffer.from(event.body||'','base64').toString('utf8'):event.body||'';
 if(!validSignature(raw,event.headers['stripe-signature']||event.headers['Stripe-Signature'],key))return {statusCode:400,body:'Invalid Stripe signature'};
 try{
   const evt=JSON.parse(raw);const s=evt.data?.object;
   if(!s?.id)return {statusCode:200,body:'Ignored'};
   const oid=s.metadata?.order_id||s.client_reference_id;
   if(!oid||!/^[a-f0-9-]{36}$/i.test(oid))return {statusCode:200,body:'Ignored missing order ID'};
   if(evt.type==='checkout.session.completed'&&s.payment_status==='paid'||evt.type==='checkout.session.async_payment_succeeded'){
     if(s.currency!=='thb'||!Number.isInteger(s.amount_total))throw Error('Unexpected payment currency/amount');
     await rpc('mark_paid_order',{p_order_id:oid,p_session_id:s.id,p_total_satang:s.amount_total});
   }else if(evt.type==='checkout.session.expired'||evt.type==='checkout.session.async_payment_failed'){
     await rpc('release_order',{p_order_id:oid});
   }
   return {statusCode:200,body:'OK'};
 }catch(ex){console.error('Stripe event failed:',ex);return {statusCode:500,body:'Processing failed; retry required'}}
};
