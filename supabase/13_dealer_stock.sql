-- ============================================================
--  대리점별 재고 + 사후관리 사용 부품 (기존 데이터 유지)
--  Supabase > SQL Editor 에 붙여넣고 Run 하세요.
-- ============================================================

create table if not exists public.dealer_stock (
  id uuid primary key default gen_random_uuid(),
  dealer text not null,
  item text not null,
  qty int default 0,
  unique (dealer, item)
);
alter table public.dealer_stock enable row level security;
drop policy if exists "auth all" on public.dealer_stock;
create policy "auth all" on public.dealer_stock for all to authenticated using (true) with check (true);

-- 사후관리에서 사용/교체한 부품 기록
alter table public.aftercare add column if not exists used_item text default '';
alter table public.aftercare add column if not exists used_qty int default 0;

-- 기존 발송 내역을 대리점 재고로 초기 반영
insert into public.dealer_stock (dealer, item, qty)
select dealer, item, sum(qty)
from public.dealer_supplies
where coalesce(dealer,'') <> '' and coalesce(item,'') <> ''
group by dealer, item
on conflict (dealer, item) do update set qty = excluded.qty;
