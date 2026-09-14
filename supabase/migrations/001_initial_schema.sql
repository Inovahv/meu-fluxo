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

create table public.category_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  nature transaction_type not null,
  color text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(user_id, name, nature),
  unique(id, user_id),
  check (nature in ('income', 'expense'))
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid not null,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(user_id, group_id, name),
  unique(id, user_id),
  constraint categories_group_owner_fk foreign key (group_id, user_id)
    references public.category_groups(id, user_id) on delete cascade
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
  updated_at timestamptz not null default now(),
  check (installment_number is null or installment_number > 0),
  check (installment_total is null or installment_total > 0),
  check (installment_number is null or installment_total is null or installment_number <= installment_total)
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
create index categories_user_group_idx on public.categories(user_id, group_id);
create index loan_events_loan_date_idx on public.loan_events(loan_id, event_date);

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.category_groups enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.borrowers enable row level security;
alter table public.loans enable row level security;
alter table public.loan_events enable row level security;
alter table public.vehicles enable row level security;

create policy "profiles own rows" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "accounts own rows" on public.accounts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "category groups own rows" on public.category_groups for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "categories own rows" on public.categories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "transactions own rows" on public.transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "borrowers own rows" on public.borrowers for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "loans own rows" on public.loans for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "loan events own rows" on public.loan_events for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "vehicles own rows" on public.vehicles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.create_default_financial_categories()
returns void
language plpgsql
set search_path = public
as $$
declare
  group_item jsonb;
  target_group_id uuid;
  defaults constant jsonb := '[
    {"name":"Receitas","nature":"income","order":10,"categories":["Salário","Décimo terceiro salário","Outros ganhos","Trabalho rural"]},
    {"name":"Investimentos e rendimentos","nature":"income","order":20,"categories":["Rendimentos bancários","Juros de empréstimos para terceiros"]},
    {"name":"Moradia e utilidades","nature":"expense","order":30,"categories":["Aluguel","Gás de cozinha","Mobília","Materiais domésticos","Material de consumo"]},
    {"name":"Despesas pessoais","nature":"expense","order":40,"categories":["Alimentação","Supermercado","Lazer","Saúde","Corte de cabelo"]},
    {"name":"Serviços digitais","nature":"expense","order":50,"categories":["Internet","Recarga de celular","Canva","Spotify"]},
    {"name":"Despesas veiculares","nature":"expense","order":60,"categories":["Combustível","Manutenção e acessórios","Troca de óleo","IPVA","Licenciamento","Vistoria veicular","Serviços de despachante","Aquisição de veículo","CNH"]},
    {"name":"Transporte","nature":"expense","order":70,"categories":["Passagem Águia Branca","Passagem São Gabriel","Táxi"]},
    {"name":"Materiais e compras","nature":"expense","order":80,"categories":["Equipamentos e acessórios","Vestuário e calçados","Aparelho eletrônico"]},
    {"name":"Outras despesas","nature":"expense","order":90,"categories":["Gastos com terceiros","Outros gastos","Serviços de cartório","Despesas bancárias e taxas"]}
  ]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;

  for group_item in select value from jsonb_array_elements(defaults)
  loop
    insert into public.category_groups (user_id, name, nature, sort_order)
    values (auth.uid(), group_item->>'name', (group_item->>'nature')::public.transaction_type, (group_item->>'order')::integer)
    on conflict (user_id, name, nature) do update set active = true
    returning id into target_group_id;

    insert into public.categories (user_id, group_id, name)
    select auth.uid(), target_group_id, value
    from jsonb_array_elements_text(group_item->'categories')
    on conflict (user_id, group_id, name) do nothing;
  end loop;
end;
$$;

revoke all on function public.create_default_financial_categories() from public;
grant execute on function public.create_default_financial_categories() to authenticated;

commit;
