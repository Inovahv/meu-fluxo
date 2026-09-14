begin;

alter table public.transactions
  add column if not exists source text,
  add column if not exists source_ref text,
  add column if not exists source_payload jsonb;

create unique index if not exists transactions_user_source_ref_uq
  on public.transactions(user_id, source_ref)
  where source_ref is not null;

create index if not exists transactions_user_status_settlement_idx
  on public.transactions(user_id, status, settlement_date);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, is_admin)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Usuário'
    ),
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.profiles (id, full_name, is_admin)
select
  u.id,
  coalesce(
    nullif(u.raw_user_meta_data->>'full_name', ''),
    nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
    'Usuário'
  ),
  false
from auth.users u
on conflict (id) do nothing;

update public.profiles p
set is_admin = true,
    updated_at = now()
from auth.users u
where p.id = u.id
  and lower(coalesce(u.email, '')) = lower('vieirahenrique321@gmail.com');

drop policy if exists "profiles admins read all" on public.profiles;
create policy "profiles admins read all"
  on public.profiles
  for select
  using (auth.uid() = id or public.is_admin());

commit;
