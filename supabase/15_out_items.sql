-- ============================================================
--  일정: 출고 기기 여러 개(모델·구분·수량) 지원
--  Supabase > SQL Editor 에 붙여넣고 Run 하세요. (편집기 비우고)
-- ============================================================
alter table public.events add column if not exists out_items jsonb default '[]'::jsonb;

-- 기존 단일 출고 기록을 새 형식으로 이관
update public.events
set out_items = jsonb_build_array(
  jsonb_build_object('model', coalesce(nullif(out_model,''),'OS2'), 'kind', '완성품', 'qty', out_qty)
)
where coalesce(out_qty,0) > 0
  and (out_items is null or out_items = '[]'::jsonb);
