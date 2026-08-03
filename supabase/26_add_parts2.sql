-- ============================================================
--  부품 추가: 석회필터 · 석회필터 연결관 (직원 요청)
--  Supabase > SQL Editor 에 붙여넣고 Run 하세요. (편집기 비우고)
-- ============================================================

insert into public.parts (name, model, category, per_unit, unit, stock, as_type, favorite, note)
values
  ('석회필터',        '공용', '소모품', 0, '개', 0, '교체 대상', true, 'A/S·정기점검 교체품'),
  ('석회필터 연결관', '공용', '소모품', 0, '개', 0, '교체 대상', true, '석회필터 연결관')
on conflict (name, model, category) do update
  set as_type = excluded.as_type,
      favorite = excluded.favorite,
      note = excluded.note;
