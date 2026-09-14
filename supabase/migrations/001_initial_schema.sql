begin;

create extension if not exists pgcrypto;

create type public.transaction_type as enum ('income', 'expense', 'transfer', 'adjustment');
create type public.transaction_status as enum ('planned', 'completed', 'overdue', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  cpf text unique,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  account_type text not null default 'checking',
  initial_balance numeric(14,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  group_name text not null,
  name text not null,
  nature transaction_type not null,
  color text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(user_id, group_name, name, nature)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  type transaction_type not null,
  status transaction_status not null default 'completed',
  description text not null,
  notes text,
  payment_method text,
  amount numeric(14,2) not null check (amount >= 0),
  competence_date date not null,
  settlement_date date,
  installment_group_id uuid,
  installment_number integer,
  installment_total integer,
  vehicle_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.borrowers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  document text,
  contact text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  borrower_id uuid not null references public.borrowers(id) on delete restrict,
  monthly_rate numeric(9,6) not null check (monthly_rate >= 0),
  day_count_basis integer not null default 30 check (day_count_basis > 0),
  start_date date not null,
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default now()
);

create table public.loan_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  loan_id uuid not null references public.loans(id) on delete cascade,
  event_date date not null,
  event_type text not null check (event_type in ('disbursement','payment','rate_change','adjustment')),
  amount numeric(14,2) not null check (amount >= 0),
  interest_component numeric(14,2) not null default 0,
  principal_component numeric(14,2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  plate text,
  make text,
  model text,
  model_year integer,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

alter table public.transactions add constraint transactions_vehicle_fk foreign key (vehicle_id) references public.vehicles(id) on delete set null;

create index transactions_user_date_idx on public.transactions(user_id, competence_date desc);
create index transactions_user_status_idx on public.transactions(user_id, status);
create index loan_events_loan_date_idx on public.loan_events(loan_id, event_date);

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.borrowers enable row level security;
alter table public.loans enable row level security;
alter table public.loan_events enable row level security;
alter table public.vehicles enable row level security;

create policy "profiles own rows" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "accounts own rows" on public.accounts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "categories own rows" on public.categories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "transactions own rows" on public.transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "borrowers own rows" on public.borrowers for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "loans own rows" on public.loans for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "loan events own rows" on public.loan_events for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "vehicles own rows" on public.vehicles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

commit;
