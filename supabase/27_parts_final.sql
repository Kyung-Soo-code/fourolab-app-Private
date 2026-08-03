-- ============================================================
--  부품 정리: LCD PCB(제작 포함) · 석회필터(A/S 전용) · 정제염
--  Supabase > SQL Editor 에 붙여넣고 Run 하세요. (편집기 비우고)
--  ※ 여러 번 실행해도 안전합니다.
-- ============================================================

-- 1) LCD PCB — 기기 제작에 1개 사용 (제작 시 자동 차감)
insert into public.parts (name, model, category, per_unit, unit, stock, as_type, favorite, note)
values ('LCD PCB', 'OS2', 'PCB판', 1, '개', 0, '교체 대상', true, '디스플레이 기판 · 1기당 1개')
on conflict (name, model, category) do update
  set per_unit = 1,
      as_type = '교체 대상',
      favorite = true,
      note = '디스플레이 기판 · 1기당 1개';

-- 2) 디스플레이 커버 — 제작 1개
insert into public.parts (name, model, category, per_unit, unit, stock, note)
values ('디스플레이 커버', 'OS2', '케이스', 1, '개', 0, '')
on conflict (name, model, category) do update set per_unit = 1;

-- 3) 석회필터 · 연결관 — A/S 교체용만 (제작 미포함: 1기당 0)
insert into public.parts (name, model, category, per_unit, unit, stock, as_type, favorite, note)
values
  ('석회필터',        '공용', '소모품', 0, '개', 0, '교체 대상', true, 'A/S 교체용 (제작 미포함)'),
  ('석회필터 연결관', '공용', '소모품', 0, '개', 0, '교체 대상', true, 'A/S 교체용 (제작 미포함)')
on conflict (name, model, category) do update
  set per_unit = 0,
      as_type = '교체 대상',
      favorite = true,
      note = 'A/S 교체용 (제작 미포함)';

-- 4) 정제염 — 대리점 발송 소모품 (제작 미포함)
insert into public.parts (name, model, category, per_unit, unit, stock, as_type, favorite, note)
values ('정제염', '공용', '소모품', 0, '포', 0, '정기점검', true, '대리점 발송 소모품')
on conflict (name, model, category) do update
  set per_unit = 0, unit = '포', favorite = true;
