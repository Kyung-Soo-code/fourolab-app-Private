-- ============================================================
--  수정 이력 (감사 로그)
--  Supabase > SQL Editor 에 붙여넣고 Run 하세요. (편집기 비우고)
-- ============================================================
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor text default '',      -- 작업한 직원
  action text default '',     -- 등록 / 수정 / 삭제
  entity text default '',     -- A/S · 기기 · 병원 · 부품 ...
  detail text default '',     -- 대상 설명
  created_at timestamptz default now()
);
alter table public.audit_log enable row level security;

-- 기록은 모든 로그인 사용자가 남길 수 있고(대리점 포함), 조회는 본사만
drop policy if exists "audit insert" on public.audit_log;
create policy "audit insert" on public.audit_log
  for insert to authenticated with check (true);

drop policy if exists "audit read" on public.audit_log;
create policy "audit read" on public.audit_log
  for select to authenticated
  using (coalesce(public.my_role(),'') <> 'dealer');
