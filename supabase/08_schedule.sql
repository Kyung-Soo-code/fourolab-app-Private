-- ============================================================
--  전시·일정 / 직원 근태 테이블 (기존 데이터 유지)
--  Supabase > SQL Editor 에 붙여넣고 Run 하세요.
-- ============================================================
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  type text default '기타',
  title text default '',
  place text default '',
  event_date date,
  event_time text default '',
  end_date date,
  who text default '',
  memo text default '',
  out_model text default '',      -- OS1 / OS2 (예정 출고 모델)
  out_qty int default 0,          -- 예정 출고 대수
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);
alter table public.events enable row level security;
drop policy if exists "auth all" on public.events;
create policy "auth all" on public.events for all to authenticated using (true) with check (true);

create table if not exists public.leaves (
  id uuid primary key default gen_random_uuid(),
  type text default '연차',
  who text default '',
  start_at timestamptz,
  end_at timestamptz,
  memo text default '',
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);
alter table public.leaves enable row level security;
drop policy if exists "auth all" on public.leaves;
create policy "auth all" on public.leaves for all to authenticated using (true) with check (true);

-- 초기 샘플
insert into public.events (type, title, place, event_date, event_time, who, out_model, out_qty)
values
  ('정기점검', '서울굿모닝안과 정기점검', '서울굿모닝안과', '2026-07-17', '10:00', '이수리', '', 0),
  ('데모 출고', '천안메디안과 데모', '천안메디안과', '2026-07-21', '11:00', '이수리', 'OS2', 2),
  ('전시·세미나', 'KOPHTHAL 2026', '코엑스', '2026-07-22', '09:00', '정영업 외 3명', '', 0)
on conflict do nothing;
