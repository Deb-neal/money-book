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
