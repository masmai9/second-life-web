export const DEFAULT_CATEGORIES = [
 {slug:'watch',name:'TIMEPIECES',eyebrow:'THE CURATED WATCH EDIT',headline:'Pieces with',emphasis:'presence.',tagline_th:'นาฬิกาคัดสรร ที่พร้อมเริ่มเรื่องราวใหม่',description:'Pre-loved timepieces, thoughtfully selected.',banner_url:'',theme_preset:'watch',accent_color:'#967449',sort_order:10,is_active:true},
 {slug:'music',name:'MUSIC ROOM',eyebrow:'THE SECOND LIFE MUSIC ROOM',headline:'Find your',emphasis:'next sound.',tagline_th:'กีตาร์ เครื่องดนตรี และอุปกรณ์สำหรับเสียงในแบบคุณ',description:'Electric guitars, pedals, and expressive finds.',banner_url:'',theme_preset:'music',accent_color:'#7264a5',sort_order:20,is_active:true},
 {slug:'tech',name:'GADGETS & IT',eyebrow:'THE MODERN EDIT',headline:'Tech for',emphasis:'real life.',tagline_th:'แก็ดเจ็ตและอุปกรณ์ไอทีที่พร้อมใช้งานต่อ',description:'Smart finds for everyday life.',banner_url:'',theme_preset:'tech',accent_color:'#56badb',sort_order:30,is_active:true}
];
export const sortedCategories = categories => [...categories].sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)||a.slug.localeCompare(b.slug));
export const categoryUrl = slug => slug ? `/?category=${encodeURIComponent(slug)}` : '/';
export const categoryArt = c => ({watch:'/images/watch-gold.svg',music:'/images/guitar-black.svg',tech:'/images/tech-gadgets.svg'}[c?.theme_preset]||'/images/watch-gold.svg');
export const validColor = v => /^#[0-9a-f]{6}$/i.test(String(v||'')) ? v : '#967449';
