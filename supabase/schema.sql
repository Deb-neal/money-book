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

-- 로그인한 사용자(authenticated)에게 테이블 권한 부여. 실제 접근 범위는 위 RLS 정책이 제한한다.
grant select, insert, update, delete on public.recurring, public.transactions to authenticated;
