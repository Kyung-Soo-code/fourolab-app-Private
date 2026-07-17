-- ============================================================
--  기기 납품일 추가 (기존 데이터 유지)
--  Supabase > SQL Editor 에 붙여넣고 Run 하세요.
-- ============================================================
alter table public.devices
  add column if not exists delivered_at date;

-- (선택) 샘플 기기에 납품일 채우기
update public.devices set delivered_at = '2026-01-18' where serial = 'OS2-2405-018' and delivered_at is null;
update public.devices set delivered_at = '2023-12-10' where serial = 'OS1-2312-044' and delivered_at is null;
update public.devices set delivered_at = '2025-11-02' where serial = 'OS2-2403-009' and delivered_at is null;
update public.devices set delivered_at = '2026-07-18' where serial = 'OS2-2406-021' and delivered_at is null;
