-- ============================================================
--  소요량 보정: 초음파/바퀴 분리 · 경첩판·퓨즈 수량 지정
--  Supabase > SQL Editor 에 붙여넣고 Run 하세요. (편집기 비우고)
-- ============================================================

-- 초음파 진동자(2개) / PCB기판(1개) 분리
update public.parts
  set name = '초음파 진동자', per_unit = 2, note = ''
  where name = '초음파 진동자/PCB기판' and model = 'OS2';

insert into public.parts (name, model, category, per_unit, unit, note, stock)
values ('초음파 진동자 PCB기판', 'OS2', '소독조', 1, '개', '', 0)
on conflict (name, model, category) do nothing;

-- 경첩 판: 2개
update public.parts
  set per_unit = 2, note = ''
  where name = '경첩 판' and model = 'OS2';

-- 바퀴: 브레이크 2개 / 일반 2개 분리
update public.parts
  set name = '바퀴(브레이크)', per_unit = 2, note = ''
  where name = '바퀴' and model = 'OS2';

insert into public.parts (name, model, category, per_unit, unit, note, stock)
values ('바퀴(일반)', 'OS2', '케이스', 2, '개', '', 0)
on conflict (name, model, category) do nothing;

-- 퓨즈: 각 1개씩
update public.parts set per_unit = 1
  where name in ('퓨즈 3A', '퓨즈 6.3A', '퓨즈 10A') and model = 'OS2';
