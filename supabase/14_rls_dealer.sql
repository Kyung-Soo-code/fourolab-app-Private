-- ============================================================
--  대리점별 DB 보안(RLS) 강화  [없는 테이블은 자동으로 건너뜀]
--  - 본사(admin/staff): 전체 접근
--  - 대리점(dealer): 사후관리·자기 재고·받은 기기만 접근
--  Supabase > SQL Editor 에 붙여넣고 Run 하세요. (편집기 비우고)
-- ============================================================

-- 현재 로그인 사용자의 역할/대리점 (RLS 우회용 security definer)
create or replace function public.my_role()
  returns text language sql security definer stable set search_path = public as
$$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.my_dealer()
  returns text language sql security definer stable set search_path = public as
$$ select dealer from public.profiles where id = auth.uid() $$;

-- 프로필: 본인 것만 조회
drop policy if exists "profiles read" on public.profiles;
drop policy if exists "profiles read own" on public.profiles;
create policy "profiles read own" on public.profiles
  for select to authenticated using (auth.uid() = id);

-- 본사 전용 테이블 (대리점 접근 불가) — 존재하는 것만 적용
do $$
declare t text;
begin
  foreach t in array array[
    'hospitals','devices','parts','as_tickets','events','leaves','dealers','dealer_supplies'
  ] loop
    if to_regclass('public.'||t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists "auth all" on public.%I', t);
      execute format('drop policy if exists "hq all" on public.%I', t);
      execute format($f$create policy "hq all" on public.%I for all to authenticated
        using (coalesce(public.my_role(),'') <> 'dealer')
        with check (coalesce(public.my_role(),'') <> 'dealer')$f$, t);
    end if;
  end loop;
end $$;

-- 대리점 소유 테이블: 대리점은 자기 dealer 행만 (본사는 전체)
do $$
declare t text;
begin
  foreach t in array array['aftercare','dealer_stock'] loop
    if to_regclass('public.'||t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists "auth all" on public.%I', t);
      execute format('drop policy if exists "own or hq" on public.%I', t);
      execute format($f$create policy "own or hq" on public.%I for all to authenticated
        using (coalesce(public.my_role(),'') <> 'dealer' or dealer = public.my_dealer())
        with check (coalesce(public.my_role(),'') <> 'dealer' or dealer = public.my_dealer())$f$, t);
    end if;
  end loop;
end $$;

-- 대리점 기기 발송 로그: 대리점은 자기 것 "읽기"만, 쓰기는 본사만
do $$
begin
  if to_regclass('public.dealer_logs') is not null then
    execute 'alter table public.dealer_logs enable row level security';
    execute 'drop policy if exists "auth all" on public.dealer_logs';
    execute 'drop policy if exists "dl read" on public.dealer_logs';
    execute 'drop policy if exists "dl insert" on public.dealer_logs';
    execute 'drop policy if exists "dl update" on public.dealer_logs';
    execute 'drop policy if exists "dl delete" on public.dealer_logs';
    execute $p$create policy "dl read" on public.dealer_logs for select to authenticated
      using (coalesce(public.my_role(),'') <> 'dealer' or dealer = public.my_dealer())$p$;
    execute $p$create policy "dl insert" on public.dealer_logs for insert to authenticated
      with check (coalesce(public.my_role(),'') <> 'dealer')$p$;
    execute $p$create policy "dl update" on public.dealer_logs for update to authenticated
      using (coalesce(public.my_role(),'') <> 'dealer')
      with check (coalesce(public.my_role(),'') <> 'dealer')$p$;
    execute $p$create policy "dl delete" on public.dealer_logs for delete to authenticated
      using (coalesce(public.my_role(),'') <> 'dealer')$p$;
  end if;
end $$;
