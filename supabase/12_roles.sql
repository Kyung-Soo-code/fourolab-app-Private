-- ============================================================
--  권한(역할) 분리 + 사후관리 확장 (기존 데이터 유지)
--  Supabase > SQL Editor 에 붙여넣고 Run 하세요.
-- ============================================================

-- 직원/대리점 프로필에 소속 대리점 필드 (role 은 이미 있음: admin/staff/dealer)
alter table public.profiles add column if not exists dealer text default '';

-- 사후관리: 고장 부품 본사 발송 여부
alter table public.aftercare add column if not exists part_sent boolean default false;
alter table public.aftercare add column if not exists part_sent_note text default '';

-- ------------------------------------------------------------
-- 대리점 계정 만드는 법 (참고 · 실제 값으로 바꿔 실행)
--   1) Authentication > Users > Add user 로 대리점 이메일/비번 생성
--   2) 아래로 그 계정을 dealer 역할 + 소속 대리점으로 지정
-- update public.profiles
--   set role = 'dealer', dealer = '영남지사'
--   where id = (select id from auth.users where email = 'yeongnam@pohlab.com');
-- ------------------------------------------------------------
