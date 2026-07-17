-- ============================================================
--  대리점 거래처(담당자 여러 명) + 부품·소모품(정제염) 발송 기록
--  Supabase > SQL Editor 에 붙여넣고 Run 하세요. (기존 데이터 유지)
-- ============================================================

-- 대리점 거래처 (담당자 여러 명, 변경 가능)
create table if not exists public.dealers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region text default '',
  contacts jsonb default '[]'::jsonb,   -- [{role,name,tel}]
  note text default '',
  created_at timestamptz default now()
);
alter table public.dealers enable row level security;
drop policy if exists "auth all" on public.dealers;
create policy "auth all" on public.dealers for all to authenticated using (true) with check (true);

-- 대리점 부품/소모품 발송 (정제염·필터·도구 등)
create table if not exists public.dealer_supplies (
  id uuid primary key default gen_random_uuid(),
  dealer text default '',
  item text default '',        -- 정제염 / 필터 / 도구 등
  qty int default 0,
  unit text default '',        -- 개 / 포 / set 등
  method text default '택배',
  sent_at date,
  note text default '',
  created_at timestamptz default now()
);
alter table public.dealer_supplies enable row level security;
drop policy if exists "auth all" on public.dealer_supplies;
create policy "auth all" on public.dealer_supplies for all to authenticated using (true) with check (true);

-- 초기 샘플
insert into public.dealers (name, region) values
  ('영남지사', '부산·경남'),
  ('호남지사', '광주·전남'),
  ('충청지사', '대전·충청')
on conflict do nothing;

insert into public.dealer_supplies (dealer, item, qty, unit, method, sent_at) values
  ('영남지사', '정제염', 20, '포', '택배', '2026-07-10'),
  ('호남지사', '필터',    10, '개', '택배', '2026-07-08'),
  ('영남지사', '정제염', 15, '포', '택배', '2026-06-20')
on conflict do nothing;
