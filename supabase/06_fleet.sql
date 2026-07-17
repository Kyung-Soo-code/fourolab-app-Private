-- ============================================================
--  기기 현황 · 완성품 테스트 · 데모 회수용 컬럼 추가 (기존 데이터 유지)
--  Supabase > SQL Editor 에 붙여넣고 Run 하세요.
-- ============================================================
alter table public.devices add column if not exists note text default '';
alter table public.devices add column if not exists test_start date;
alter table public.devices add column if not exists test_count int default 0;
alter table public.devices add column if not exists test_end date;
alter table public.devices add column if not exists test_issue text default '';
