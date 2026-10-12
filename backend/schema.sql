-- Managed with the Supabase migration tool. No secrets belong in this file.
create schema if not exists rayon_private;
revoke all on schema rayon_private from public, anon;
grant usage on schema rayon_private to authenticated;

create function rayon_private.is_studio_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from auth.users u where u.id = auth.uid()
      and lower(u.email) = 'randall@rayonstudio.net'
      and u.email_confirmed_at is not null
      and coalesce(u.is_anonymous, false) = false
  );
$$;
revoke all on function rayon_private.is_studio_admin() from public, anon;
grant execute on function rayon_private.is_studio_admin() to authenticated;

create table public.rayon_tours (
  id text primary key check (id = 'sample' or id ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'),
  revision uuid not null,
  object_path text not null unique,
  title text not null check (length(title) between 1 and 120),
  published boolean not null default true,
  expires_at timestamptz,
  rooms integer not null check (rooms between 1 and 100),
  thumbnail text check (thumbnail is null or (length(thumbnail) < 150000 and thumbnail ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$')),
  updated_at timestamptz not null default now(),
  check (object_path = id || '/' || revision::text || '.json')
);
alter table public.rayon_tours enable row level security;
revoke all on public.rayon_tours from anon, authenticated;
grant select, insert, update, delete on public.rayon_tours to authenticated;
grant all on public.rayon_tours to service_role;
create policy studio_manage_tours on public.rayon_tours for all to authenticated
  using ((select rayon_private.is_studio_admin()))
  with check ((select rayon_private.is_studio_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rayon-tours', 'rayon-tours', false, 41943040, array['application/json']);
create policy studio_read_tours on storage.objects for select to authenticated
  using (bucket_id = 'rayon-tours' and (select rayon_private.is_studio_admin()));
create policy studio_upload_tours on storage.objects for insert to authenticated
  with check (bucket_id = 'rayon-tours' and (select rayon_private.is_studio_admin()));
create policy studio_delete_tours on storage.objects for delete to authenticated
  using (bucket_id = 'rayon-tours' and (select rayon_private.is_studio_admin()));
-- Immutable files: every publication uses a new revision path; no UPDATE policy.
