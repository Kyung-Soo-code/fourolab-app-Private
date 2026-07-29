-- ============================================================
--  납품 전 체크리스트 (더블 체크)
--  Supabase > SQL Editor 에 붙여넣고 Run 하세요. (편집기 비우고)
-- ============================================================
create table if not exists public.checklists (
  id uuid primary key default gen_random_uuid(),
  serial text default '',              -- 장비번호
  model text default 'OS2',            -- OS1 / OS2
  purpose text default '납품용',        -- 데모용 / 납품용
  hospital text default '',            -- 납품처(선택)
  data jsonb default '{}'::jsonb,      -- 항목별 체크/값
  note text default '',
  status text default '작성중',         -- 작성중 / 확정
  checker1_id uuid references auth.users(id),
  checker1_name text default '',
  checker1_at timestamptz,
  checker2_id uuid references auth.users(id),
  checker2_name text default '',
  checker2_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

alter table public.checklists enable row level security;
drop policy if exists "hq all" on public.checklists;
create policy "hq all" on public.checklists for all to authenticated
  using (coalesce(public.my_role(),'') <> 'dealer')
  with check (coalesce(public.my_role(),'') <> 'dealer');
