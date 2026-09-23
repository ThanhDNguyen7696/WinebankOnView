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

-- Membership management ---------------------------------------------------

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  first_name text not null default '',
  last_name text not null default '',
  email text,
  phone text,
  customer_category text not null default 'Member',
  status text not null default 'pending'
    check (status in ('pending', 'active', 'expired', 'suspended', 'cancelled')),
  start_date date,
  expiry_date date,
  source text not null default 'website',
  legacy_key text unique,
  legacy_created_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expiry_date is null or start_date is null or expiry_date >= start_date)
);

alter table public.memberships
add column if not exists customer_category text not null default 'Member';

drop index if exists public.memberships_email_unique;
create index if not exists memberships_email_index
on public.memberships (lower(email))
where email is not null and btrim(email) <> '';

alter table public.memberships enable row level security;

grant select on public.memberships to authenticated;
grant insert, update, delete on public.memberships to authenticated;

drop policy if exists "Members can read their own membership" on public.memberships;
create policy "Members can read their own membership"
on public.memberships for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.admin_users
    where admin_users.user_id = auth.uid()
  )
);

drop policy if exists "Admins can add memberships" on public.memberships;
create policy "Admins can add memberships"
on public.memberships for insert
to authenticated
with check (
  exists (
    select 1 from public.admin_users
    where admin_users.user_id = auth.uid()
  )
);

drop policy if exists "Admins can update memberships" on public.memberships;
create policy "Admins can update memberships"
on public.memberships for update
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

drop policy if exists "Admins can delete memberships" on public.memberships;
create policy "Admins can delete memberships"
on public.memberships for delete
to authenticated
using (
  exists (
    select 1 from public.admin_users
    where admin_users.user_id = auth.uid()
  )
);

create or replace function public.set_memberships_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_memberships_updated_at on public.memberships;
create trigger set_memberships_updated_at
before update on public.memberships
for each row execute function public.set_memberships_updated_at();

create or replace function public.create_or_link_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  linked_id uuid;
  email_match_count bigint;
begin
  select count(*) into email_match_count
  from public.memberships
  where user_id is null
    and email is not null
    and lower(email) = lower(new.email);

  if email_match_count = 1 then
    select id into linked_id
    from public.memberships
    where user_id is null
      and email is not null
      and lower(email) = lower(new.email)
    limit 1;

    update public.memberships
    set
      user_id = new.id,
      first_name = coalesce(nullif(first_name, ''), new.raw_user_meta_data ->> 'first_name', ''),
      last_name = coalesce(nullif(last_name, ''), new.raw_user_meta_data ->> 'last_name', ''),
      phone = coalesce(nullif(phone, ''), new.raw_user_meta_data ->> 'phone'),
      updated_at = now()
    where id = linked_id;
  else
    insert into public.memberships (
      user_id, first_name, last_name, email, phone,
      status, start_date, expiry_date, source
    ) values (
      new.id,
      coalesce(new.raw_user_meta_data ->> 'first_name', ''),
      coalesce(new.raw_user_meta_data ->> 'last_name', ''),
      lower(new.email),
      new.raw_user_meta_data ->> 'phone',
      'pending',
      new.created_at::date,
      (new.created_at + interval '1 year')::date,
      'website'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists create_membership_after_signup on auth.users;
create trigger create_membership_after_signup
after insert on auth.users
for each row execute function public.create_or_link_membership();

-- Backfill accounts that existed before membership management was enabled.
update public.memberships membership
set user_id = auth_user.id,
    updated_at = now()
from auth.users auth_user
where membership.user_id is null
  and membership.email is not null
  and lower(membership.email) = lower(auth_user.email)
  and 1 = (
    select count(*) from public.memberships candidate
    where candidate.user_id is null
      and candidate.email is not null
      and lower(candidate.email) = lower(auth_user.email)
  )
  and not exists (
    select 1 from public.memberships existing
    where existing.user_id = auth_user.id
  );

insert into public.memberships (
  user_id, first_name, last_name, email, phone,
  status, start_date, expiry_date, source
)
select
  auth_user.id,
  coalesce(auth_user.raw_user_meta_data ->> 'first_name', ''),
  coalesce(auth_user.raw_user_meta_data ->> 'last_name', ''),
  lower(auth_user.email),
  auth_user.raw_user_meta_data ->> 'phone',
  'pending',
  auth_user.created_at::date,
  (auth_user.created_at + interval '1 year')::date,
  'website'
from auth.users auth_user
where not exists (
  select 1 from public.memberships membership
  where membership.user_id = auth_user.id
);

-- Events management -------------------------------------------------------

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_date date not null,
  start_time time,
  short_description text not null,
  registration_url text,
  image_path text,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'hidden')),
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists events_public_listing_index
on public.events (status, event_date, display_order);

alter table public.events enable row level security;
grant select on public.events to anon, authenticated;
grant insert, update, delete on public.events to authenticated;

drop policy if exists "Public can read published events" on public.events;
create policy "Public can read published events"
on public.events for select
to public
using (
  status = 'published'
  or exists (
    select 1 from public.admin_users
    where admin_users.user_id = auth.uid()
  )
);

drop policy if exists "Admins can add events" on public.events;
create policy "Admins can add events"
on public.events for insert
to authenticated
with check (
  exists (
    select 1 from public.admin_users
    where admin_users.user_id = auth.uid()
  )
);

drop policy if exists "Admins can update events" on public.events;
create policy "Admins can update events"
on public.events for update
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

drop policy if exists "Admins can delete events" on public.events;
create policy "Admins can delete events"
on public.events for delete
to authenticated
using (
  exists (
    select 1 from public.admin_users
    where admin_users.user_id = auth.uid()
  )
);

create or replace function public.set_events_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_events_updated_at on public.events;
create trigger set_events_updated_at
before update on public.events
for each row execute function public.set_events_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-images',
  'event-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read event images" on storage.objects;
create policy "Public can read event images"
on storage.objects for select
to public
using (bucket_id = 'event-images');

drop policy if exists "Admins can upload event images" on storage.objects;
create policy "Admins can upload event images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'event-images'
  and exists (
    select 1 from public.admin_users
    where admin_users.user_id = auth.uid()
  )
);

drop policy if exists "Admins can replace event images" on storage.objects;
create policy "Admins can replace event images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'event-images'
  and exists (
    select 1 from public.admin_users
    where admin_users.user_id = auth.uid()
  )
)
with check (
  bucket_id = 'event-images'
  and exists (
    select 1 from public.admin_users
    where admin_users.user_id = auth.uid()
  )
);

drop policy if exists "Admins can delete event images" on storage.objects;
create policy "Admins can delete event images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'event-images'
  and exists (
    select 1 from public.admin_users
    where admin_users.user_id = auth.uid()
  )
);
