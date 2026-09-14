begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

revoke all on function private.is_admin() from public, anon, authenticated;
grant execute on function private.is_admin() to authenticated;

drop policy if exists "profiles admins read all" on public.profiles;
create policy "profiles admins read all"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id or (select private.is_admin()));

drop trigger if exists on_auth_user_created on auth.users;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  insert into public.profiles (id, full_name, email, is_admin)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Usuário'
    ),
    new.email,
    false
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name),
        updated_at = now();
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

drop function if exists public.is_admin();
drop function if exists public.handle_new_user();

commit;
