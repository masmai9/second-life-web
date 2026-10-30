import { createHash,timingSafeEqual,randomUUID } from 'node:crypto';
import {reply,supaRequest,supabase,secret} from '../lib/_utils.mjs';

function photoType(buf){
 if(buf.length>3&&buf[0]===0xff&&buf[1]===0xd8&&buf[2]===0xff)return {mime:'image/jpeg',ext:'jpg'};
 if(buf.length>8&&buf.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return {mime:'image/png',ext:'png'};
 if(buf.length>12&&buf.toString('ascii',0,4)==='RIFF'&&buf.toString('ascii',8,12)==='WEBP')return {mime:'image/webp',ext:'webp'};
 throw Error('รองรับเฉพาะไฟล์ JPG, PNG หรือ WEBP');
}
async function removeObject(path){try{await fetch(`${supabase}/storage/v1/object/payment-slips/${path}`,{method:'DELETE',headers:{apikey:secret,Authorization:`Bearer ${secret}`}})}catch{}}
export const handler=async event=>{
 if(event.httpMethod!=='POST')return reply(405,{error:'Method not allowed'});
 if(!supabase||!secret)return reply(503,{error:'ระบบรับสลิปยังไม่พร้อม'});
 let uploadedPath='';
 try{
  if((event.body||'').length>4300000)throw Error('ไฟล์สลิปใหญ่เกิน 3 MB');
  const data=JSON.parse(event.body||'{}');
  const order=String(data.order_id||'');const token=String(data.token||'');
  if(!/^[0-9a-f-]{36}$/i.test(order)||!/^[0-9a-f]{64}$/i.test(token))throw Error('ข้อมูลคำสั่งซื้อไม่ถูกต้อง');
  const list=await supaRequest(`orders?select=id,status,payment_method,payment_token_hash,payment_expires_at&id=eq.${order}&limit=1`);
  const row=list?.[0];if(!row||row.payment_method!=='bank_transfer')throw Error('ไม่พบคำสั่งซื้อโอนเงิน');
  const hashed=createHash('sha256').update(token).digest('hex');
  if(!row.payment_token_hash||!timingSafeEqual(Buffer.from(hashed),Buffer.from(row.payment_token_hash)))throw Error('ไม่สามารถยืนยันสิทธิ์แนบสลิป');
  if(row.status!=='awaiting_payment')throw Error('รายการนี้ส่งสลิปแล้ว หรือถูกปิดไปแล้ว');
  if(!row.payment_expires_at || Date.now()>new Date(row.payment_expires_at).getTime())throw Error('รายการจองหมดอายุแล้ว โปรดติดต่อร้านก่อนโอนเงิน');
  const image=String(data.file_base64||'');
  if(image.length>4100000||image.length<64||!/^[A-Za-z0-9+/=]+$/.test(image))throw Error('สลิปไม่ถูกต้องหรือใหญ่เกิน 3 MB');
  const bytes=Buffer.from(image,'base64');
  if(bytes.length>3000000||bytes.length<128)throw Error('ไฟล์ต้องมีขนาดไม่เกิน 3 MB');
  const type=photoType(bytes);uploadedPath=`${order}/${randomUUID()}.${type.ext}`;
  const r=await fetch(`${supabase}/storage/v1/object/payment-slips/${uploadedPath}`,{
    method:'POST',headers:{apikey:secret,Authorization:`Bearer ${secret}`,'Content-Type':type.mime,'x-upsert':'false'},body:bytes
  });
  if(!r.ok)throw Error('อัปโหลดสลิปไม่สำเร็จ กรุณาลองใหม่');
  const updated=await supaRequest(`orders?id=eq.${order}&status=eq.awaiting_payment&payment_method=eq.bank_transfer`,{
    method:'PATCH',headers:{Prefer:'return=representation'},
    body:JSON.stringify({payment_slip_path:uploadedPath,slip_uploaded_at:new Date().toISOString(),status:'pending_review'})
  });
  if(!updated?.length)throw Error('สถานะคำสั่งซื้อเปลี่ยนแล้ว โปรดติดต่อร้าน');
  return reply(200,{ok:true,order_id:order,status:'pending_review'});
 }catch(ex){if(uploadedPath)await removeObject(uploadedPath);console.error('Slip submission:',ex.message);return reply(400,{error:ex.message})}
};
