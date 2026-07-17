-- ============================================================
--  대리점 발송 용도 + A/S 수리 주체 + 대리점 사후관리(정기점검) 모듈
--  Supabase > SQL Editor 에 붙여넣고 Run 하세요. (기존 데이터 유지)
-- ============================================================

-- 대리점 발송 용도 (완성품 / 데모용)
alter table public.dealer_logs add column if not exists purpose text default '완성품';

-- A/S 수리 주체 (본사 / 대리점 / 제3업체)
alter table public.as_tickets add column if not exists repair_by text default '본사';
alter table public.as_tickets add column if not exists repair_dealer text default '';

-- 대리점 사후관리 (대리점이 나간 정기점검 · A/S 기록)
create table if not exists public.aftercare (
  id uuid primary key default gen_random_uuid(),
  dealer text default '',
  hospital text default '',
  serial text default '',
  type text default '정기점검',    -- 정기점검 / A/S
  visit_date date,
  checked text default '',         -- 점검 사항
  replaced text default '',        -- 교체 사항
  photos jsonb default '[]'::jsonb,
  status text default '완료',       -- 예정 / 완료
  note text default '',
  created_at timestamptz default now()
);
alter table public.aftercare enable row level security;
drop policy if exists "auth all" on public.aftercare;
create policy "auth all" on public.aftercare for all to authenticated using (true) with check (true);

-- 초기 샘플
insert into public.aftercare (dealer, hospital, serial, type, visit_date, checked, status)
values
  ('영남지사', '창원밝은안과', 'OS2-2403-011', '정기점검', '2026-07-10', '급배수 정상 · 필터 상태 양호', '완료')
on conflict do nothing;
