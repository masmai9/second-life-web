# SECOND LIFE — เว็บไซต์ร้านค้าออนไลน์ต้นแบบ v1.0

ร้านนาฬิกามือสองและเครื่องดนตรี — วังน้ำเย็น จังหวัดสระแก้ว

ออกแบบให้ **ดูตัวอย่างได้ทันทีโดยไม่ต้องติดตั้งแพ็กเกจ** และต่อยอดเป็นร้านค้าออนไลน์จริงผ่าน **Netlify + Supabase + Stripe** โดยไม่เก็บข้อมูลบัตรเครดิตบนเซิร์ฟเวอร์ร้านเอง

> **สำคัญ:** ค่าเริ่มต้นคือ DEMO MODE ซึ่งใช้สินค้า/ราคา **ตัวอย่างสมมติ** การคลิกจ่ายเงินจะไม่เรียกเก็บเงินจริง เจ้าของร้านต้องเชื่อมระบบและทดสอบด้วย Stripe Test Mode ให้เสร็จก่อนเปิดขายจริง

## A. ดูหน้าเว็บต้นแบบ (ง่ายที่สุด)

1. แตก ZIP
2. เปิด Terminal/Command Prompt ในโฟลเดอร์ `second-life-shop` หรือคลิก `START_WINDOWS.bat` บน Windows
3. ถ้าทำเองให้ใช้คำสั่ง `python -m http.server 8000 --directory site` (บน Mac อาจใช้ `python3`)
4. เปิด `http://localhost:8000` เพื่อดูหน้าร้าน และ `http://localhost:8000/admin.html` เพื่อดูหลังร้านทดลอง

แนะนำให้เปิดผ่านเว็บเซิร์ฟเวอร์ท้องถิ่น ไม่ใช่เปิด `index.html` ด้วยการดับเบิลคลิกตรง ๆ เพราะเบราว์เซอร์บางตัวห้าม ES Modules บน `file://`

**ใน DEMO MODE:** เพิ่ม/แก้/ลบสินค้า เปลี่ยนสต็อกได้ในหลังร้าน แต่ข้อมูลเก็บเฉพาะ browser ของเครื่องนั้น ไม่ซิงก์กับคนอื่น ลองอัปโหลดภาพขนาดเล็กได้ ส่วนวิดีโออัปโหลดต้องเชื่อม Supabase ก่อน

## B. เปิดเว็บไซต์ฟรีให้มี URL สาธารณะ

1. สร้างบัญชี Netlify และ GitHub
2. สร้าง repository ใหม่บน GitHub แล้วอัปโหลด **ทั้งโฟลเดอร์โปรเจกต์** (ต้องมี `netlify.toml`, `site/`, `netlify/functions/`)
3. ใน Netlify เลือก Add new project → Import from Git แล้วเลือก repository
4. Netlify อ่านค่าใน `netlify.toml`: Publish directory = `site`, Functions directory = `netlify/functions` ไม่ต้องลง npm
5. Deploy แล้วจะได้โดเมน `*.netlify.app` (ชื่อที่ต้องการขึ้นกับความว่าง)
6. เปลี่ยน site name ใน Netlify เป็นสั้น ๆ เช่น `secondlife-sakaeo` **ถ้ายังว่าง**

หมายเหตุ: การลากเฉพาะโฟลเดอร์ `site/` ไปยัง Netlify Drop ดูหน้าเว็บได้ แต่ **ฟังก์ชันจ่ายเงินและหน้า SEO server-rendered จะยังไม่ครบ** ควร deploy ทั้ง repo ด้วย Git

## C. เปิดระบบสต็อกจริงด้วย Supabase

1. สมัคร Supabase → New project
2. ไปที่ SQL Editor วางและรันไฟล์ `supabase/schema.sql` **ครั้งเดียว**
3. ไปที่ Authentication → Users สร้างบัญชีเจ้าของร้านด้วยอีเมลจริง ตั้งรหัสผ่านแข็งแรง
4. คัดลอก **User UUID** จากหน้า Users แล้วกลับ SQL Editor รัน:

   ```sql
   insert into public.admins (user_id)
   values ('UUID-ของผู้ดูแลร้าน');
   ```

5. Supabase → Project Settings → API คัดลอก **Project URL** กับ **anon/publishable key** ไปใส่ใน `site/config.js` เป็น `supabaseUrl` และ `supabaseAnonKey`
6. ใน Netlify → Site configuration → Environment variables เพิ่ม:

   | ชื่อ | ค่า |
   |---|---|
   | `SUPABASE_URL` | Project URL จาก Supabase |
   | `SUPABASE_ANON_KEY` | public anon key จาก Supabase |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase **secret service_role key** (ใส่เฉพาะ Netlify Environment เท่านั้น) |
   | `SITE_URL` | `https://ชื่อเว็บจริง.netlify.app` (หรือใช้ URL ที่ Netlify ตั้งให้อัตโนมัติ) |

7. Push การแก้ `config.js` ขึ้น GitHub → Netlify Deploy ใหม่
8. ไปที่ `/admin.html` แล้ว login ด้วยบัญชีผู้ดูแลร้าน เพิ่มสินค้าจริง อัปโหลดภาพ/วิดีโอ ใส่ราคาจริงและจำนวนคงเหลือ

**ข้อห้าม:** ห้ามใส่ `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` ลงใน `site/config.js` หรือ commit ไป GitHub เนื่องจากเป็นความลับฝั่งเซิร์ฟเวอร์

ในโหมดจริง Supabase จะเริ่มต้นด้วย **สินค้า 0 รายการ**: ต้องเพิ่มจากหลังร้านเอง สินค้าเดโมจะไม่ถูกส่งขึ้นฐานข้อมูลอัตโนมัติ

**พื้นที่ไฟล์:** Supabase Free มี storage 1GB, ไฟล์ขนาดสูงสุด 50MB (โครงการนี้จำกัดภาพ 8MB และวิดีโอ 45MB) ควรบีบอัด MP4 ก่อนอัปโหลดหรือใช้ระบบวิดีโอภายนอกสำหรับคลิปยาว

## D. เปิดรับบัตรเครดิตและ PromptPay QR จริงผ่าน Stripe

1. สร้างบัญชี Stripe Thailand และดำเนินการยืนยันธุรกิจ/บัญชีธนาคารตามที่ Stripe กำหนด (การมีเว็บไซต์ไม่ได้ทำให้เปิดรับเงินจริงอัตโนมัติ)
2. Stripe Dashboard → Settings → Payment methods เปิด **Card** และ **PromptPay** ตามสิทธิ์บัญชี
3. ที่ Netlify Environment variables เพิ่ม `STRIPE_SECRET_KEY` — เริ่มด้วย **Test key** (`sk_test_...`) ก่อน
4. Stripe Dashboard → Developers → Webhooks → Add endpoint:
   `https://โดเมนเว็บ/.netlify/functions/stripe-webhook`
5. เลือก event ต่อไปนี้:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `checkout.session.expired`
6. คัดลอก Stripe **signing secret** (`whsec_...`) ใส่ใน Netlify เป็น `STRIPE_WEBHOOK_SECRET`
7. ถ้าให้จัดส่งทั่วประเทศ เพิ่ม `DELIVERY_FEE_THB` เป็น **จำนวนเต็มบาท** เช่น `100` เป็นเพียงตัวอย่าง กรุณากำหนดค่าจัดส่งจริงด้วยตัวเอง หากไม่กำหนดจะสั่งจ่ายได้เฉพาะรับสินค้าที่ร้าน
8. Deploy ใหม่ จากนั้นทดสอบซื้อผ่าน Stripe Test Mode จนเห็นออเดอร์สถานะ `paid` ในหลังร้าน ตรวจสอบว่าสต็อกลดตอนจอง และคืนสต็อกเมื่อเซสชัน Stripe หมดอายุ
9. เมื่อทดสอบผ่านแล้วจึงเปลี่ยนเป็น **Live keys และ Live webhook secret** พร้อมตรวจสอบค่าธรรมเนียม เงื่อนไขธุรกิจ นโยบายการคืนเงิน และจัดส่งจริง

**ระบบทำงานอย่างไร:** ลูกค้าเลือกสินค้า → ส่ง ID/จำนวน → ฟังก์ชันเซิร์ฟเวอร์อ่านราคาจริงจากฐานข้อมูลและจองสต็อกแบบ atomic → Stripe Checkout ให้ลูกค้าชำระผ่านหน้า Stripe → เว็บรับ webhook ที่ตรวจลายเซ็นแล้วเท่านั้น จึงเปลี่ยนสถานะออเดอร์เป็น paid. รายการหมดอายุจะคืนสต็อกผ่าน webhook

**ข้อควรทราบ:** ถ้าไม่มี webhook หรือ webhook ผิด สต็อกที่จองอาจค้างอยู่ ดังนั้น webhook เป็นขั้นตอนบังคับ หากมีรายการที่ต้องแก้ไข/คืนเงิน ให้ตรวจสถานะกับ Stripe ก่อน และทดสอบก่อนเปิดรับยอดเงินจริงเสมอ

สำหรับรายการบัตร: ร้านรับเต็มยอดผ่าน Stripe ส่วนการแปลงยอดเป็นผ่อนภายหลังขึ้นอยู่กับเงื่อนไขและสิทธิ์ธนาคารของผู้ถือบัตร ไม่ได้การันตีว่าทุกบัตรทำได้

## E. SEO ให้คนวังน้ำเย็น/สระแก้วค้นหาเจอ

มีให้แล้ว:
- `<title>` และ `<meta name="description">` สำหรับหน้าแรก
- หน้าแยก `/products/ชื่อ-slug` สร้าง HTML ชื่อ/คำบรรยาย/ราคาแบบ server-rendered พร้อม `Product` structured data
- `Store` / `LocalBusiness`-compatible schema สำหรับหน้าแรก (ต้องเพิ่มที่อยู่จริงเมื่อพร้อม)
- Dynamic XML sitemap: `https://โดเมนเว็บ/sitemap.xml` เพื่อรวมสินค้าที่เปิดขาย
- Robots และ Open Graph metadata
- ชื่อหมวดและเนื้อหาเกี่ยวกับนาฬิกามือสอง กีตาร์ไฟฟ้า วังน้ำเย็น สระแก้ว

สิ่งที่เจ้าของร้านต้องทำเองเมื่อพร้อม:
1. ใส่ **ที่อยู่จริง** และเวลาทำการในเว็บไซต์และ Google Business Profile (อย่าใส่ที่อยู่ปลอม)
2. สร้าง/ยืนยัน **Google Business Profile** ให้ปักหมุดและเปิดรีวิวลูกค้า
3. สมัคร **Google Search Console** ยืนยันความเป็นเจ้าของโดเมน แล้วส่ง `/sitemap.xml`
4. ลงสินค้าจริงตั้งชื่อรุ่นชัด ๆ เช่น `Seiko Presage มือสอง` ไม่ใช่ `นาฬิกาสวย 01` พร้อมรูปถ่ายจริงและข้อความตรงไปตรงมา
5. เชื่อม URL จาก TikTok, Facebook, LINE, Google Business Profile และโพสต์ที่เกี่ยวข้อง
6. ถ่ายรูปหน้าร้านจริง ใส่ช่องทางติดต่อ ตรวจข้อมูลให้ตรงกันทุกแพลตฟอร์ม และตอบรีวิวที่ได้รับจริง

**ไม่มีใครรับประกันอันดับ 1 ของ Google ได้** โดยเฉพาะ Local Search ที่ขึ้นกับความเกี่ยวข้อง ระยะห่าง และความเป็นที่รู้จักของร้าน การมี structured data ไม่ได้แปลว่าจะถูกจัดอันดับสูงเสมอ

## F. เปลี่ยนข้อมูลร้านที่ต้องตั้งเอง

ใน `site/config.js`:
- `location` — แสดงตำบล/อำเภอและจังหวัด
- `lineUrl` — ลิงก์ LINE Official หรือ LINE ที่ใช้จริง
- `phone` — เบอร์ร้านที่ใช้จริง
- `mapUrl` — ลิงก์ Google Maps ของร้านที่ยืนยันแล้ว
- `siteUrl` — URL หน้าเว็บจริง

ใน `site/index.html` ให้แก้ `<script type="application/ld+json">` เพิ่ม full `streetAddress`, เบอร์โทร, เวลาทำการ และ URL จริงหลังยืนยันข้อมูลถูกต้อง เพื่อช่วยให้ Google เข้าใจธุรกิจยิ่งขึ้น

## G. โครงสร้างไฟล์

```
second-life-shop/
├── site/                     เว็บจริงที่เปิดในเบราว์เซอร์
│   ├── index.html            หน้าร้าน / สองธีม
│   ├── admin.html            หลังร้าน
│   ├── main.js               ค้นหา / แกลเลอรี / ตะกร้า / ชำระเงิน
│   ├── admin.js              สต็อก / รูป / วิดีโอ / ออเดอร์
│   ├── store-api.js          Supabase API + Demo Mode
│   ├── config.js             PUBLIC settings เท่านั้น
│   ├── data.js               ข้อมูลตัวอย่าง
│   └── images/*.svg          ภาพประกอบเดโม (ไม่ใช่ภาพสินค้าจริง)
├── netlify/functions/
│   ├── create-checkout.mjs   จองสต็อกและสร้าง Stripe Checkout
│   ├── stripe-webhook.mjs    ยืนยันการชำระเงิน / คืนสต็อก
│   ├── product-page.mjs      HTML สินค้าและ Product SEO schema
│   └── sitemap.mjs           XML sitemap
├── supabase/schema.sql       ตาราง / RLS / stock transactions
├── netlify.toml              ตั้งค่า deploy ฟรี
└── README_TH.md
```

## H. ข้อจำกัดและงานก่อนเปิดขายจริง

- ตัวอย่างสต็อก/ราคา/ภาพเป็น mockup ไม่ใช่ข้อมูลสินค้าจริง
- ต้องทดสอบ Netlify + Supabase + Stripe **ในบัญชีจริงของร้าน** ก่อนเปิดรับเงินจริง — ชุด ZIP นี้ไม่มีบัญชีหรือคีย์เชื่อมต่อ
- ยังไม่มีระบบอีเมลยืนยันคำสั่งซื้อ, tracking พัสดุ, คูปอง, คำนวณค่าจัดส่งหลายพื้นที่, ภาษี/ใบกำกับภาษี, dashboard รายงานกำไร, การจัดการคืนเงินแบบอัตโนมัติ, CAPTCHA หรือระบบจัดการความยินยอม PDPA แบบครบถ้วน
- เว็บเริ่มต้นมีตะกร้า checkout และจองสต็อก แต่ควรทดสอบโหลดพร้อมกัน การชำระล้มเหลว/หมดเวลา และ edge cases ก่อนใช้จริง
- ให้เพิ่มหน้าเงื่อนไขการขาย การจัดส่ง การคืนสินค้า และนโยบายความเป็นส่วนตัวตามธุรกิจจริงก่อนขายออนไลน์
- ตรวจสอบ Stripe fees, Netlify usage credits, Supabase project pauses และที่เก็บข้อมูลวิดีโออย่างต่อเนื่องตามข้อกำหนดผู้ให้บริการ

> เริ่มเร็วที่สุด: ดูเดโมก่อน → เปิด Netlify URL → ตั้ง Supabase และใส่สินค้าจริง → ทดสอบ Stripe → เปิด Google Business Profile และ Search Console

**ลบสินค้าในโหมดจริง:** ปุ่มลบจะ *ซ่อนสินค้า* (soft-delete) เพื่อรักษาข้อมูลสต็อกที่อาจติดอยู่กับคำสั่งซื้อ ไม่ใช่ลบแถวออกจากฐานข้อมูล ส่วนในโหมดทดลองจะลบข้อมูลตัวอย่างบนเครื่องทันที
