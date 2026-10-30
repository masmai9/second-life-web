const reply=(statusCode,body,extra={})=>({statusCode,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...extra},body:JSON.stringify(body)});
export {reply};
export const supabase=(process.env.SUPABASE_URL||'').replace(/\/$/,'');
export const secret=process.env.SUPABASE_SERVICE_ROLE_KEY||'';
export const siteUrl=(process.env.URL||process.env.SITE_URL||'').replace(/\/$/,'');
export async function rpc(fn,args){if(!supabase||!secret)throw Error('Server database not configured');const r=await fetch(`${supabase}/rest/v1/rpc/${fn}`,{method:'POST',headers:{apikey:secret,authorization:`Bearer ${secret}`,'Content-Type':'application/json'},body:JSON.stringify(args)});if(!r.ok){const t=await r.text();throw Error(`Database error: ${t.slice(0,300)}`)}const raw=await r.text();return raw?JSON.parse(raw):null}
export async function supaRequest(path,options={}){const r=await fetch(`${supabase}/rest/v1/${path}`,{...options,headers:{apikey:secret,authorization:`Bearer ${secret}`,'Content-Type':'application/json',...options.headers}});if(!r.ok)throw Error(`Database status ${r.status}: ${(await r.text()).slice(0,400)}`);const t=await r.text();return t?JSON.parse(t):null}
export function siteOrigin(requestHeaders={}){return siteUrl||`https://${requestHeaders.host || 'example.netlify.app'}`}
