-- ============================================================
--  부품(BOM) 테이블 추가 — A/S 교체 부품 선택용
--  Supabase > SQL Editor 에 붙여넣고 Run 하세요. (기존 데이터 유지)
-- ============================================================
create table if not exists public.parts (
  id uuid primary key default gen_random_uuid(),
  model text default '공용',        -- OS1 / OS2 / 공용
  name text not null,
  vendor text default '',
  price int default 0,
  buy_url text default '',
  per_unit int default 0,           -- 1기당 소요 수량
  stock int default 0,              -- 현재고
  floor1 int default 0,
  floor2 int default 0,
  floor3 int default 0,
  toolbox int default 0,            -- 공구함 재고
  as_type text default '',          -- 교체 대상 / 정기점검
  favorite boolean default false,   -- 즐겨찾기(A/S에서 위에 표시)
  created_at timestamptz default now()
);

alter table public.parts enable row level security;
drop policy if exists "auth all" on public.parts;
create policy "auth all" on public.parts for all to authenticated using (true) with check (true);

-- 초기 부품 샘플 (favorite = A/S 자주 쓰는 부품)
insert into public.parts (name, vendor, price, per_unit, stock, as_type, favorite)
values
  ('급수 호스',  '대성유압',   8500,  2, 6, '교체 대상', true),
  ('피팅',       '한독피팅',   1200,  8, 14, '교체 대상', true),
  ('배수 펌프',  '대성유압',  22000,  1, 2, '교체 대상', true),
  ('필터',       '클린텍',     4000,  2, 3, '정기점검',  true),
  ('OCT 모듈',   'OptiCore', 420000,  1, 4, '',          false),
  ('전원 보드',  '세종전자',  65000,  1, 5, '',          false),
  ('연결 라인',  '대성유압',   3500,  2, 8, '교체 대상', false),
  ('감압 밸브',  '한독피팅',   9000,  1, 4, '교체 대상', false)
on conflict do nothing;
