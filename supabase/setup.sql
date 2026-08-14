-- WineBank production admin PDF menu setup
-- Safe to run more than once.
-- Uses only authenticated user identity + RLS. Never use a secret/service-role key in browser code.

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

-- Existing projects can keep this self-check policy as a compatibility fallback.
drop policy if exists "Users can check own admin status" on public.admin_users;
create policy "Users can check own admin status"
on public.admin_users
for select
to authenticated
using (user_id = auth.uid());

-- Central admin check used by Storage policies and newer frontend code.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'menu-pdfs',
  'menu-pdfs',
  true,
  10485760,
  array['application/pdf']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf'];

-- INSERT is needed the first time current-menu.pdf is created.
drop policy if exists "Admins can upload menu PDFs" on storage.objects;
create policy "Admins can upload menu PDFs"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'menu-pdfs'
  and public.is_admin()
);

-- UPDATE is needed when upsert replaces the existing live file.
drop policy if exists "Admins can update menu PDFs" on storage.objects;
create policy "Admins can update menu PDFs"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'menu-pdfs'
  and public.is_admin()
)
with check (
  bucket_id = 'menu-pdfs'
  and public.is_admin()
);

-- Admin dashboard reads file metadata to show live status, date and size.
drop policy if exists "Admins can read menu PDF metadata" on storage.objects;
create policy "Admins can read menu PDF metadata"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'menu-pdfs'
  and public.is_admin()
);

-- Kept for maintenance; the current UI does not expose a delete button.
drop policy if exists "Admins can delete menu PDFs" on storage.objects;
create policy "Admins can delete menu PDFs"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'menu-pdfs'
  and public.is_admin()
);
