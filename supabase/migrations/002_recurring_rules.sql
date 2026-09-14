begin;

create table if not exists public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type public.transaction_type not null,
  amount numeric(14,2) not null check (amount >= 0),
  category_id uuid references public.categories(id) on delete set null,
  account_id uuid references public.accounts(id) on delete set null,
  payment_method text,
  frequency text not null default 'monthly' check (frequency in ('monthly')),
  day_of_month integer not null check (day_of_month between 1 and 31),
  start_date date not null,
  end_date date,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (type in ('income','expense')),
  check (end_date is null or end_date >= start_date)
);

create index if not exists recurring_rules_user_active_idx
  on public.recurring_rules(user_id, active, start_date);

alter table public.recurring_rules enable row level security;

drop policy if exists "recurring rules own rows" on public.recurring_rules;
create policy "recurring rules own rows"
  on public.recurring_rules
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists recurring_rules_touch_updated_at on public.recurring_rules;
create trigger recurring_rules_touch_updated_at
before update on public.recurring_rules
for each row execute function public.touch_updated_at();

drop trigger if exists transactions_touch_updated_at on public.transactions;
create trigger transactions_touch_updated_at
before update on public.transactions
for each row execute function public.touch_updated_at();

commit;
