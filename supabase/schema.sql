-- money-book 스키마
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 실행하세요.

create table if not exists public.recurring (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  title        text not null,
  type         text not null check (type in ('expense', 'income', 'saving')),
  category     text not null,
  amount       bigint not null check (amount >= 0),
  day_of_month smallint not null default 1 check (day_of_month between 1 and 31),
  account      text,
  memo         text,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create table if not exists public.transactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  date         date not null,
  type         text not null check (type in ('expense', 'income', 'saving')),
  category     text not null,
  title        text not null default '',
  amount       bigint not null check (amount >= 0),
  account      text,
  memo         text,
  recurring_id uuid references public.recurring (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists transactions_user_date_idx on public.transactions (user_id, date);

-- 행 단위 보안: 로그인한 본인 데이터만 읽고 쓸 수 있다.
alter table public.recurring    enable row level security;
alter table public.transactions enable row level security;

drop policy if exists "own recurring" on public.recurring;
create policy "own recurring" on public.recurring
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own transactions" on public.transactions;
create policy "own transactions" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  title      text not null default '',
  body       text not null default '',
  pinned     boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_user_updated_idx on public.notes (user_id, updated_at desc);

alter table public.notes enable row level security;

drop policy if exists "own notes" on public.notes;
create policy "own notes" on public.notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 로그인한 사용자(authenticated)에게 테이블 권한 부여. 실제 접근 범위는 위 RLS 정책이 제한한다.
grant select, insert, update, delete on public.recurring, public.transactions, public.notes to authenticated;

-- 카드사별 월 청구액. 거래 지출 합계와 분리해 중복 집계를 막는다.
create table if not exists public.card_bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  issuer text not null check (length(issuer) between 1 and 40 and issuer = btrim(issuer)),
  billing_month text not null check (billing_month ~ '^(19|20|21)[0-9]{2}-(0[1-9]|1[0-2])$'),
  total_amount bigint not null check (total_amount between 0 and 999999999999),
  due_date date,
  as_of_date date,
  lump_sum bigint check (lump_sum between 0 and 999999999999),
  installment bigint check (installment between 0 and 999999999999),
  memo text check (length(memo) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, issuer, billing_month),
  check (due_date is null or to_char(due_date, 'YYYY-MM') = billing_month)
);

create index if not exists card_bills_user_month_idx on public.card_bills (user_id, billing_month);
alter table public.card_bills enable row level security;
drop policy if exists "own card bills" on public.card_bills;
create policy "own card bills" on public.card_bills
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.card_bills to authenticated;
