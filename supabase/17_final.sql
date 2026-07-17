-- ============================================================
--  불량/로스 · 발주 · 인증서류 · 원가비교 · 전시 상세
--  Supabase > SQL Editor 에 붙여넣고 Run 하세요. (편집기 비우고)
-- ============================================================

-- 불량 · 재고 로스 기록
create table if not exists public.stock_issues (
  id uuid primary key default gen_random_uuid(),
  part text not null,
  type text default '불량',        -- 불량 / 로스
  qty int default 0,
  reason text default '',
  issued_at date,
  created_at timestamptz default now()
);
alter table public.stock_issues enable row level security;
drop policy if exists "hq all" on public.stock_issues;
create policy "hq all" on public.stock_issues for all to authenticated
  using (coalesce(public.my_role(),'') <> 'dealer')
  with check (coalesce(public.my_role(),'') <> 'dealer');

-- 부품 발주 (발주일 / 도착 예정 / 도착 처리 시 재고 반영)
create table if not exists public.part_orders (
  id uuid primary key default gen_random_uuid(),
  part text not null,
  vendor text default '',
  qty int default 0,
  price int default 0,
  ordered_at date,
  eta date,
  arrived boolean default false,
  arrived_at date,
  note text default '',
  created_at timestamptz default now()
);
alter table public.part_orders enable row level security;
drop policy if exists "hq all" on public.part_orders;
create policy "hq all" on public.part_orders for all to authenticated
  using (coalesce(public.my_role(),'') <> 'dealer')
  with check (coalesce(public.my_role(),'') <> 'dealer');

-- 신규 부품 원가 비교 (견적)
create table if not exists public.part_quotes (
  id uuid primary key default gen_random_uuid(),
  part text not null,
  vendor text default '',
  price int default 0,
  link text default '',
  note text default '',
  created_at timestamptz default now()
);
alter table public.part_quotes enable row level security;
drop policy if exists "hq all" on public.part_quotes;
create policy "hq all" on public.part_quotes for all to authenticated
  using (coalesce(public.my_role(),'') <> 'dealer')
  with check (coalesce(public.my_role(),'') <> 'dealer');

-- 부품 인증 서류 첨부
alter table public.parts add column if not exists docs jsonb default '[]'::jsonb;

-- 전시 상세 (부스 사진 · 컨택 바이어 · 해외 선적 동봉 품목)
alter table public.events add column if not exists booth_photos jsonb default '[]'::jsonb;
alter table public.events add column if not exists buyers text default '';
alter table public.events add column if not exists shipping_items text default '';
