-- ============================================================
--  대리점 관리 테이블 (기존 데이터 유지)
--  Supabase > SQL Editor 에 붙여넣고 Run 하세요.
-- ============================================================
create table if not exists public.dealer_logs (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'in',   -- in: 본사→대리점, out: 대리점→병원
  serial text,
  model text,
  dealer text default '',
  hospital text default '',          -- out(대리점→병원)일 때 납품 병원
  method text default '',            -- 화물 / 직접 등
  status text default '',
  log_date date,
  note text default '',
  created_at timestamptz default now()
);

alter table public.dealer_logs enable row level security;
drop policy if exists "auth all" on public.dealer_logs;
create policy "auth all" on public.dealer_logs for all to authenticated using (true) with check (true);

-- 초기 샘플
insert into public.dealer_logs (kind, serial, model, dealer, method, status, log_date)
values
  ('in', 'OS2-2406-024', 'OS2', '영남지사', '화물', '대리점 보관', '2026-07-09'),
  ('in', 'OS1-2405-061', 'OS1', '호남지사', '화물', '대리점 보관', '2026-07-03'),
  ('in', 'OS2-2404-019', 'OS2', '충청지사', '직접', '출고 예정',   '2026-06-28')
on conflict do nothing;

insert into public.dealer_logs (kind, serial, dealer, hospital, status, log_date)
values
  ('out', 'OS2-2403-011', '영남지사', '창원밝은안과', '납품 완료', '2026-07-11'),
  ('out', 'OS1-2402-058', '호남지사', '여수봄안과',   '납품 완료', '2026-07-04')
on conflict do nothing;
