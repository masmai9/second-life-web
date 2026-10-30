import {createHash,timingSafeEqual} from 'node:crypto';
import {reply,supaRequest,secret} from '../lib/_utils.mjs';

export const handler=async event=>{
 if(event.httpMethod!=='POST')return reply(405,{error:'Method not allowed'});
 if(!secret)return reply(503,{error:'ระบบสถานะคำสั่งซื้อยังไม่พร้อม'});
 try{
  const body=JSON.parse(event.body||'{}'),id=String(body.order_id||''),token=String(body.token||'');
  if(!/^[0-9a-f-]{36}$/i.test(id)||!/^[0-9a-f]{64}$/i.test(token))throw Error('ข้อมูลคำสั่งซื้อไม่ถูกต้อง');
  const rows=await supaRequest(`orders?select=id,status,payment_method,payment_token_hash,payment_expires_at&id=eq.${id}&limit=1`);
  const o=rows?.[0];const hash=createHash('sha256').update(token).digest('hex');
  if(!o||o.payment_method!=='bank_transfer'||typeof o.payment_token_hash!=='string'||o.payment_token_hash.length!==64||!timingSafeEqual(Buffer.from(hash),Buffer.from(o.payment_token_hash)))throw Error('ไม่มีสิทธิ์เข้าถึงคำสั่งซื้อนี้');
  return reply(200,{order_id:id,status:o.status,expires_at:o.payment_expires_at});
 }catch(e){return reply(400,{error:e.message})}
};
