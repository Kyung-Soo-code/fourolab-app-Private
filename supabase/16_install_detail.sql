-- ============================================================
--  설치 관리 상세 + A/S 소비자 코멘트·층별 사진
--  Supabase > SQL Editor 에 붙여넣고 Run 하세요. (편집기 비우고)
-- ============================================================

-- 설치 상세 (기기 단위)
alter table public.devices add column if not exists install_place text default '';   -- 설치 층수/장소
alter table public.devices add column if not exists water_pressure text default '';  -- 수압 체크
alter table public.devices add column if not exists water_time text default '';      -- 급수 설정 시간
alter table public.devices add column if not exists survey text default '';          -- 사전 답사
alter table public.devices add column if not exists crew text default '';            -- 투입 인력
alter table public.devices add column if not exists transport text default '';       -- 운송 방법
alter table public.devices add column if not exists improvement text default '';     -- 현장 개선 요구사항
alter table public.devices add column if not exists improvement_done text default ''; -- 반영 여부
alter table public.devices add column if not exists biz text default '';             -- 영업 주체
alter table public.devices add column if not exists install_photos jsonb default '[]'::jsonb; -- 설치 완료 사진

-- A/S: 소비자 코멘트 + 층별 점검 사진
alter table public.as_tickets add column if not exists customer_comment text default '';
alter table public.as_tickets add column if not exists photos_f1 jsonb default '[]'::jsonb;
alter table public.as_tickets add column if not exists photos_f2 jsonb default '[]'::jsonb;
alter table public.as_tickets add column if not exists photos_f3 jsonb default '[]'::jsonb;
