-- SECOND LIFE / 001: Category manager + shareable category routes
-- Run ONLY this file once in Supabase Dashboard > SQL Editor (or safely re-run).
-- NON-DESTRUCTIVE: no DROP TABLE, DELETE, TRUNCATE or changes to auth, media, orders.
-- Existing products (watch/music), media files and admin accounts remain unchanged.
BEGIN;

CREATE TABLE IF NOT EXISTS public.categories (
  slug text PRIMARY KEY CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  eyebrow text NOT NULL DEFAULT '' CHECK (char_length(eyebrow) <= 100),
  headline text NOT NULL DEFAULT '' CHECK (char_length(headline) <= 100),
  emphasis text NOT NULL DEFAULT '' CHECK (char_length(emphasis) <= 100),
  tagline_th text NOT NULL DEFAULT '' CHECK (char_length(tagline_th) <= 240),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 500),
  banner_url text NOT NULL DEFAULT '' CHECK (char_length(banner_url) <= 2000),
  theme_preset text NOT NULL DEFAULT 'watch' CHECK (theme_preset IN ('watch', 'music', 'tech')),
  accent_color text NOT NULL DEFAULT '#967449' CHECK (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order integer NOT NULL DEFAULT 100 CHECK (sort_order BETWEEN -10000 AND 10000),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- IMPORTANT: these names match the existing products.category values exactly.
INSERT INTO public.categories
 (slug, name, eyebrow, headline, emphasis, tagline_th, description, theme_preset, accent_color, sort_order, is_active)
VALUES
 ('watch','TIMEPIECES','THE CURATED WATCH EDIT','Pieces with','presence.','นาฬิกาคัดสรร ที่พร้อมเริ่มเรื่องราวใหม่','Pre-loved timepieces, thoughtfully selected.','watch','#967449',10,true),
 ('music','MUSIC ROOM','THE SECOND LIFE MUSIC ROOM','Find your','next sound.','กีตาร์ เครื่องดนตรี และอุปกรณ์สำหรับเสียงในแบบคุณ','Electric guitars, pedals, and expressive finds.','music','#7264a5',20,true),
 ('tech','GADGETS & IT','THE MODERN EDIT','Tech for','real life.','แก็ดเจ็ตและอุปกรณ์ไอทีที่พร้อมใช้งานต่อ','Smart finds for everyday life.','tech','#56badb',30,true)
ON CONFLICT (slug) DO NOTHING;

-- Replace the old fixed two-value restriction with a foreign key to categories.
-- Existing products rows are NOT modified or deleted.
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_category_check;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.products'::regclass AND conname = 'products_category_fkey'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_category_fkey FOREIGN KEY (category)
      REFERENCES public.categories(slug) ON UPDATE RESTRICT ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS categories_display_idx ON public.categories(is_active,sort_order,slug);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='categories' AND policyname='public sees categories') THEN
  CREATE POLICY "public sees categories" ON public.categories
    FOR SELECT TO anon,authenticated USING (is_active OR public.is_store_admin());
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='categories' AND policyname='admin inserts categories') THEN
  CREATE POLICY "admin inserts categories" ON public.categories
    FOR INSERT TO authenticated WITH CHECK (public.is_store_admin());
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='categories' AND policyname='admin updates categories') THEN
  CREATE POLICY "admin updates categories" ON public.categories
    FOR UPDATE TO authenticated USING (public.is_store_admin()) WITH CHECK (public.is_store_admin());
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='categories' AND policyname='admin deletes categories') THEN
  CREATE POLICY "admin deletes categories" ON public.categories
    FOR DELETE TO authenticated USING (public.is_store_admin());
 END IF;
END $$;

GRANT SELECT ON public.categories TO anon,authenticated;
GRANT INSERT,UPDATE,DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
COMMIT;

-- VERIFY (optional):
-- select slug, name, theme_preset, is_active from public.categories order by sort_order;
-- select id, title, category from public.products order by created_at desc limit 10;
