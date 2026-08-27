-- Run once in Supabase Dashboard > SQL Editor.
-- The menus bucket is public so visitors can read the current menu.
-- Uploading is restricted to users listed in public.admin_users.

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

drop policy if exists "Admins can read their own role" on public.admin_users;
create policy "Admins can read their own role"
on public.admin_users for select
to authenticated
using (user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('menus', 'menus', true, 10485760, array['application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read menus" on storage.objects;
create policy "Public can read menus"
on storage.objects for select
to public
using (bucket_id = 'menus');

drop policy if exists "Admins can upload menus" on storage.objects;
create policy "Admins can upload menus"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'menus'
  and exists (
    select 1 from public.admin_users
    where admin_users.user_id = auth.uid()
  )
);

drop policy if exists "Admins can replace menus" on storage.objects;
create policy "Admins can replace menus"
on storage.objects for update
to authenticated
using (
  bucket_id = 'menus'
  and exists (
    select 1 from public.admin_users
    where admin_users.user_id = auth.uid()
  )
)
with check (
  bucket_id = 'menus'
  and exists (
    select 1 from public.admin_users
    where admin_users.user_id = auth.uid()
  )
);

-- After creating an admin in Authentication > Users, replace the email below
-- and run this statement separately:
-- insert into public.admin_users (user_id)
-- select id from auth.users where email = 'owner@example.com'
-- on conflict (user_id) do nothing;

-- Cellar catalogue ---------------------------------------------------------

create table if not exists public.wines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region text not null default '',
  vintage text not null default 'NV',
  price numeric(10, 2) not null check (price >= 0),
  wine_type text not null default 'red',
  description text not null default '',
  image_path text,
  is_published boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.wines enable row level security;

grant select on public.wines to anon, authenticated;
grant insert, update, delete on public.wines to authenticated;

drop policy if exists "Public can view published wines" on public.wines;
create policy "Public can view published wines"
on public.wines for select
to public
using (
  is_published
  or exists (
    select 1 from public.admin_users
    where admin_users.user_id = auth.uid()
  )
);

drop policy if exists "Admins can add wines" on public.wines;
create policy "Admins can add wines"
on public.wines for insert
to authenticated
with check (
  exists (
    select 1 from public.admin_users
    where admin_users.user_id = auth.uid()
  )
);

drop policy if exists "Admins can update wines" on public.wines;
create policy "Admins can update wines"
on public.wines for update
to authenticated
using (
  exists (
    select 1 from public.admin_users
    where admin_users.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.admin_users
    where admin_users.user_id = auth.uid()
  )
);

drop policy if exists "Admins can delete wines" on public.wines;
create policy "Admins can delete wines"
on public.wines for delete
to authenticated
using (
  exists (
    select 1 from public.admin_users
    where admin_users.user_id = auth.uid()
  )
);

create or replace function public.set_wines_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_wines_updated_at on public.wines;
create trigger set_wines_updated_at
before update on public.wines
for each row execute function public.set_wines_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'wine-images',
  'wine-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view wine images" on storage.objects;
create policy "Public can view wine images"
on storage.objects for select
to public
using (bucket_id = 'wine-images');

drop policy if exists "Admins can upload wine images" on storage.objects;
create policy "Admins can upload wine images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'wine-images'
  and exists (
    select 1 from public.admin_users
    where admin_users.user_id = auth.uid()
  )
);

drop policy if exists "Admins can update wine images" on storage.objects;
create policy "Admins can update wine images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'wine-images'
  and exists (
    select 1 from public.admin_users
    where admin_users.user_id = auth.uid()
  )
)
with check (
  bucket_id = 'wine-images'
  and exists (
    select 1 from public.admin_users
    where admin_users.user_id = auth.uid()
  )
);

drop policy if exists "Admins can delete wine images" on storage.objects;
create policy "Admins can delete wine images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'wine-images'
  and exists (
    select 1 from public.admin_users
    where admin_users.user_id = auth.uid()
  )
);
