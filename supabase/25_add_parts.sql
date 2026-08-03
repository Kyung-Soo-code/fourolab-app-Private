-- ============================================================
--  누락 부품 추가 (직원 요청 반영)
--  Supabase > SQL Editor 에 붙여넣고 Run 하세요. (편집기 비우고)
-- ============================================================

-- LCD PCB (디스플레이 기판) — [PCB판] 분류, 1기당 1개
insert into public.parts (name, model, category, per_unit, unit, stock, as_type, favorite, note)
values ('LCD PCB', 'OS2', 'PCB판', 1, '개', 0, '교체 대상', true, '디스플레이 기판')
on conflict (name, model, category) do update
  set per_unit = excluded.per_unit,
      as_type = excluded.as_type,
      note = excluded.note;

-- 디스플레이 커버 (체크리스트 29번 항목 관련)
insert into public.parts (name, model, category, per_unit, unit, stock, note)
values ('디스플레이 커버', 'OS2', '케이스', 1, '개', 0, '')
on conflict (name, model, category) do nothing;
