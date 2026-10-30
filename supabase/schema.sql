-- SECOND LIFE: run once in Supabase SQL Editor. Replace the admin UUID at the end.
-- This is a starter production schema, not a replacement for a full security audit.
create extension if not exists pgcrypto;
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 130),
  category text not null check (category in ('watch','music')),
  price integer not null check (price between 0 and 100000000),
  stock integer not null default 0 check (stock between 0 and 100000),
  condition text not null default '',
  description text not null default '',
  media jsonb not null default '[]'::jsonb check (jsonb_typeof(media)='array'),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists products_category_idx on public.products(category,is_active);
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'awaiting_payment' check(status in ('awaiting_payment','paid','cancelled')),
  customer jsonb not null,
  delivery text not null check(delivery in ('pickup','shipping')),
  items jsonb not null,
  shipping_thb integer not null default 0 check(shipping_thb>=0),
  total_thb integer not null check(total_thb>=0),
  stripe_session_id text unique,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists orders_created_idx on public.orders(created_at desc);

create or replace function public.is_store_admin() returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.admins where user_id = (select auth.uid()));
$$;
revoke all on function public.is_store_admin() from public;
grant execute on function public.is_store_admin() to authenticated,anon;

alter table public.admins enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
create policy "admin self lookup" on public.admins for select to authenticated using(user_id=auth.uid());
create policy "public sees active items" on public.products for select to anon,authenticated using(is_active or public.is_store_admin());
create policy "admin adds products" on public.products for insert to authenticated with check(public.is_store_admin());
create policy "admin edits products" on public.products for update to authenticated using(public.is_store_admin()) with check(public.is_store_admin());
create policy "admin deletes products" on public.products for delete to authenticated using(public.is_store_admin());
create policy "admin reads orders" on public.orders for select to authenticated using(public.is_store_admin());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('media','media',true, 50000000, ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime'])
on conflict(id) do update set public=true, file_size_limit=50000000,
allowed_mime_types=excluded.allowed_mime_types;
create policy "admin upload media" on storage.objects for insert to authenticated with check(bucket_id='media' and public.is_store_admin());
create policy "admin delete media" on storage.objects for delete to authenticated using(bucket_id='media' and public.is_store_admin());

-- Stock is reserved atomically using Stripe Checkout's 30-minute expiration.
-- Never trust prices or quantities from the browser.
create or replace function public.reserve_order(p_items jsonb,p_customer jsonb,p_delivery text,p_shipping_fee integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare entry jsonb; rec public.products%rowtype; qty int; sum_thb bigint := 0; line_items jsonb := '[]'::jsonb; order_uuid uuid;
begin
 if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items)>15 then raise exception 'Invalid cart'; end if;
 if p_delivery not in ('pickup','shipping') or p_shipping_fee is null or p_shipping_fee<0 or p_shipping_fee>100000 then raise exception 'Invalid shipping'; end if;
 if jsonb_typeof(p_customer) <> 'object' then raise exception 'Invalid customer'; end if;
 for entry in select value from jsonb_array_elements(p_items) order by value->>'id' loop
   if not (entry ? 'id') or (entry->>'qty') !~ '^[0-9]+$' then raise exception 'Invalid cart line'; end if;
   qty := (entry->>'qty')::int;
   if qty<1 or qty>20 then raise exception 'Invalid quantity'; end if;
   update public.products set stock=stock-qty where id=(entry->>'id')::uuid and is_active and stock>=qty returning * into rec;
   if not found then raise exception 'Out of stock or item unavailable'; end if;
   sum_thb := sum_thb + rec.price::bigint*qty;
   line_items := line_items || jsonb_build_array(jsonb_build_object('id',rec.id,'title',rec.title,'slug',rec.slug,'price',rec.price,'qty',qty));
 end loop;
 if sum_thb+p_shipping_fee>100000000 then raise exception 'Order too large'; end if;
 insert into public.orders(customer,delivery,items,shipping_thb,total_thb)
 values(p_customer,p_delivery,line_items,p_shipping_fee,(sum_thb+p_shipping_fee)::int)
 returning id into order_uuid;
 return jsonb_build_object('order_id',order_uuid,'items',line_items,'total_thb',(sum_thb+p_shipping_fee)::int,'shipping_thb',p_shipping_fee);
end $$;

create or replace function public.attach_session(p_order_id uuid,p_session_id text)
returns void language plpgsql security definer set search_path=public as $$
begin
 update public.orders set stripe_session_id=p_session_id where id=p_order_id and status='awaiting_payment';
 if not found then raise exception 'Order already closed'; end if;
end $$;

create or replace function public.release_order(p_order_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare o public.orders%rowtype; i jsonb;
begin
 select * into o from public.orders where id=p_order_id for update;
 if not found or o.status <> 'awaiting_payment' then return; end if;
 update public.orders set status='cancelled' where id=p_order_id;
 for i in select value from jsonb_array_elements(o.items) loop
   update public.products set stock=stock+(i->>'qty')::int where id=(i->>'id')::uuid;
 end loop;
end $$;

create or replace function public.mark_paid_order(p_order_id uuid,p_session_id text,p_total_satang integer)
returns void language plpgsql security definer set search_path=public as $$
declare o public.orders%rowtype;
begin
 select * into o from public.orders where id=p_order_id for update;
 if not found then raise exception 'Unknown order'; end if;
 if o.status='paid' then return; end if;
 if o.status<>'awaiting_payment' then raise exception 'Unexpected payment for released order: manual refund/reconciliation required'; end if;
 if o.total_thb*100 <> p_total_satang then raise exception 'Payment amount mismatch'; end if;
 if o.stripe_session_id is not null and o.stripe_session_id<>p_session_id then raise exception 'Stripe session mismatch'; end if;
 update public.orders set status='paid',paid_at=now(),stripe_session_id=p_session_id where id=p_order_id;
end $$;
revoke all on function public.reserve_order(jsonb,jsonb,text,integer) from public,anon,authenticated;
revoke all on function public.attach_session(uuid,text) from public,anon,authenticated;
revoke all on function public.release_order(uuid) from public,anon,authenticated;
revoke all on function public.mark_paid_order(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.reserve_order(jsonb,jsonb,text,integer) to service_role;
grant execute on function public.attach_session(uuid,text) to service_role;
grant execute on function public.release_order(uuid) to service_role;
grant execute on function public.mark_paid_order(uuid,text,integer) to service_role;

-- Create an admin using Authentication -> Users in Supabase first.
-- Then run manually replacing the placeholder with that user's UUID:
-- insert into public.admins(user_id) values ('REPLACE-WITH-YOUR-AUTH-USER-UUID');

-- Explicit grants for projects with restrictive custom default privileges.
grant usage on schema public to anon,authenticated,service_role;
grant select on public.products to anon,authenticated;
grant insert,update,delete on public.products to authenticated;
grant select on public.admins,public.orders to authenticated;
grant all on public.products,public.orders,public.admins to service_role;
