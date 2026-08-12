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
