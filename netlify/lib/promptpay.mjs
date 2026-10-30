// Bank of Thailand Thai QR Payment (PromptPay credit transfer) EMV Merchant Presented Mode.
// Amount is an integer in THB, calculated by the database (never by the browser).
function tlv(tag,value){if(value.length>99)throw Error('Invalid QR field length');return `${tag}${String(value.length).padStart(2,'0')}${value}`}
function crc16(s){let crc=0xffff;for(const ch of s){crc^=ch.charCodeAt(0)<<8;for(let i=0;i<8;i++)crc=((crc&0x8000)?(crc<<1)^0x1021:crc<<1)&0xffff}return crc.toString(16).toUpperCase().padStart(4,'0')}
export function promptpayPayload(id,amount){
 const digits=String(id||'').replace(/[\s-]/g,'');
 let target;
 if(/^0[689]\d{8}$/.test(digits))target=tlv('01',`0066${digits.slice(1)}`);
 else if(/^66[689]\d{8}$/.test(digits))target=tlv('01',`00${digits}`);
 else if(/^\d{13}$/.test(digits))target=tlv('02',digits);
 else throw Error('PROMPTPAY_ID must be Thai mobile (06/08/09) or 13-digit tax/ID number');
 if(!Number.isSafeInteger(amount)||amount<1||amount>99999999)throw Error('Invalid transfer amount');
 const merchant=tlv('00','A000000677010111')+target;
 const payload=tlv('00','01')+tlv('01','12')+tlv('29',merchant)+tlv('53','764')+tlv('54',`${amount}.00`)+tlv('58','TH')+'6304';
 return payload+crc16(payload);
}
