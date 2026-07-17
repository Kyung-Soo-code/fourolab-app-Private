-- ============================================================
--  포오랩 사내 공유 시스템 — 데이터베이스 스키마 (MVP)
--  Supabase 대시보드 > SQL Editor 에 붙여넣고 [Run] 실행하세요.
--  로그인 + 병원 + 기기 + A/S 접수 모듈용입니다.
-- ============================================================

-- 1) 직원 프로필 (Supabase Auth 사용자와 1:1)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  dept text default '',
  role text default 'staff',      -- admin / staff
  created_at timestamptz default now()
);

-- 2) 병원
create table if not exists public.hospitals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  manager text default '',
  tel text default '',
  biz text default '',            -- 본사 직영 / 대리점 / 소개
  addr text default '',
  checkup_next date,              -- 다음 정기점검일
  checkup_cycle text default '3개월',
  created_at timestamptz default now()
);

-- 3) 기기 (고유번호 1대 단위)
create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  serial text not null unique,
  model text not null check (model in ('OS1','OS2')),
  category text not null default '완성품',  -- 완성품/데모/전시/A/S/납품
  status text default '',
  hospital_id uuid references public.hospitals(id) on delete set null,
  produced_at date,
  created_at timestamptz default now()
);

-- 4) A/S 접수
create table if not exists public.as_tickets (
  id uuid primary key default gen_random_uuid(),
  device_id uuid references public.devices(id) on delete set null,
  serial text,
  model text,
  hospital_id uuid references public.hospitals(id) on delete set null,
  hospital_name text,
  received_at timestamptz default now(),   -- 접수일시
  visited_at timestamptz,                  -- 방문일시
  symptom text default '',                 -- 증상 / 원인
  fix_comment text default '',             -- 사내 수리 코멘트 (어떻게/왜 수리했는지)
  parts text default '',                   -- 교체 부품
  ship text default '',                    -- 부품 택배 발송
  manager text default '',                 -- 담당자
  priority text default '진행중',           -- 긴급 / 진행중 / 원격 / 완료
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- ============================================================
--  RLS (행 수준 보안) — 사내 전용: 로그인한 직원만 접근
-- ============================================================
alter table public.profiles   enable row level security;
alter table public.hospitals  enable row level security;
alter table public.devices    enable row level security;
alter table public.as_tickets enable row level security;

-- 로그인 사용자는 모든 데이터를 읽고 쓸 수 있음(내부 협업 도구)
drop policy if exists "auth all" on public.hospitals;
create policy "auth all" on public.hospitals for all to authenticated using (true) with check (true);

drop policy if exists "auth all" on public.devices;
create policy "auth all" on public.devices for all to authenticated using (true) with check (true);

drop policy if exists "auth all" on public.as_tickets;
create policy "auth all" on public.as_tickets for all to authenticated using (true) with check (true);

-- 프로필: 로그인 사용자는 전체 조회 가능, 본인 것만 수정
drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select to authenticated using (true);
drop policy if exists "profiles self" on public.profiles;
create policy "profiles self" on public.profiles for update to authenticated using (auth.uid() = id);

-- ============================================================
--  신규 직원 가입 시 프로필 자동 생성
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
--  초기 샘플 데이터 (원하면 삭제 후 실제 데이터로 교체)
-- ============================================================
insert into public.hospitals (name, manager, tel, biz, addr, checkup_next)
values
  ('서울굿모닝안과', '박민수 원장', '010-2345-6789', '본사 직영', '서울 강남구', '2026-10-17'),
  ('대구메디안과',   '김영호 원장', '010-3456-7890', '본사 직영', '대구 수성구', '2026-09-14'),
  ('수원제일안과',   '이정아 실장', '010-8765-4321', '본사 · 데모', '경기 수원시', null)
on conflict do nothing;

-- 기기 샘플 (병원 연결)
insert into public.devices (serial, model, category, status, produced_at, hospital_id)
select v.serial, v.model, v.category, v.status, v.produced_at::date, h.id
from (values
  ('OS2-2405-018', 'OS2', '납품', '설치 완료', '2024-05-01', '서울굿모닝안과'),
  ('OS1-2312-044', 'OS1', '납품', '설치 완료', '2023-12-01', '서울굿모닝안과'),
  ('OS2-2403-009', 'OS2', '납품', '설치 완료', '2025-11-01', '대구메디안과'),
  ('OS2-2406-021', 'OS2', '데모', '데모중',    '2024-06-01', '수원제일안과')
) as v(serial, model, category, status, produced_at, hospital_name)
join public.hospitals h on h.name = v.hospital_name
on conflict (serial) do nothing;
