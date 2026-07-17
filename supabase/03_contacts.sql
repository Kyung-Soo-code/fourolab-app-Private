-- ============================================================
--  담당자 여러 명 지원 — 컬럼 추가 (기존 데이터 유지)
--  Supabase > SQL Editor 에 붙여넣고 Run 하세요.
-- ============================================================

-- 병원: 담당자 여러 명 (간호사·수간호사·구매팀 등)
alter table public.hospitals
  add column if not exists contacts jsonb default '[]'::jsonb;

-- A/S: 접수자(병원측) 여러 명 (누가 A/S를 요청했는지)
alter table public.as_tickets
  add column if not exists reporters jsonb default '[]'::jsonb;
