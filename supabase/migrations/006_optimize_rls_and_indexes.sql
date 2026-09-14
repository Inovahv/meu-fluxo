begin;

drop policy if exists "accounts own rows" on public.accounts;
create policy "accounts own rows" on public.accounts for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "borrowers own rows" on public.borrowers;
create policy "borrowers own rows" on public.borrowers for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "categories own rows" on public.categories;
create policy "categories own rows" on public.categories for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "category groups own rows" on public.category_groups;
create policy "category groups own rows" on public.category_groups for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "loan events own rows" on public.loan_events;
create policy "loan events own rows" on public.loan_events for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "loans own rows" on public.loans;
create policy "loans own rows" on public.loans for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "recurring rules own rows" on public.recurring_rules;
create policy "recurring rules own rows" on public.recurring_rules for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "transactions own rows" on public.transactions;
create policy "transactions own rows" on public.transactions for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "vehicles own rows" on public.vehicles;
create policy "vehicles own rows" on public.vehicles for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "profiles own rows" on public.profiles;
drop policy if exists "profiles admins read all" on public.profiles;
create policy "profiles read authorized" on public.profiles for select to authenticated
  using ((select auth.uid()) = id or (select private.is_admin()));
create policy "profiles update own" on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, cpf) on public.profiles to authenticated;

create index if not exists accounts_user_id_idx on public.accounts(user_id);
create index if not exists borrowers_user_id_idx on public.borrowers(user_id);
create index if not exists categories_group_user_idx on public.categories(group_id, user_id);
create index if not exists categories_user_id_idx on public.categories(user_id);
create index if not exists category_groups_user_id_idx on public.category_groups(user_id);
create index if not exists loan_events_user_id_idx on public.loan_events(user_id);
create index if not exists loan_events_loan_id_idx on public.loan_events(loan_id);
create index if not exists loans_user_id_idx on public.loans(user_id);
create index if not exists loans_borrower_id_idx on public.loans(borrower_id);
create index if not exists recurring_rules_user_id_idx on public.recurring_rules(user_id);
create index if not exists recurring_rules_category_id_idx on public.recurring_rules(category_id);
create index if not exists recurring_rules_account_id_idx on public.recurring_rules(account_id);
create index if not exists transactions_user_id_idx on public.transactions(user_id);
create index if not exists transactions_account_id_idx on public.transactions(account_id);
create index if not exists transactions_category_id_idx on public.transactions(category_id);
create index if not exists transactions_vehicle_id_idx on public.transactions(vehicle_id);
create index if not exists vehicles_user_id_idx on public.vehicles(user_id);

commit;
