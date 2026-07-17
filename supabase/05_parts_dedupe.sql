-- ============================================================
--  부품 중복 정리 + 모델별 중복 방지
--  (부품 SQL을 두 번 실행해 같은 이름이 2개씩 생긴 경우 정리)
--  Supabase > SQL Editor 에 붙여넣고 Run 하세요.
-- ============================================================

-- 1) 모델이 비어있으면 '공용' 으로 채움
update public.parts set model = '공용' where model is null or model = '';

-- 2) 같은 이름 + 같은 모델 중복 제거 (하나만 남김)
delete from public.parts a
using public.parts b
where a.name = b.name
  and a.model = b.model
  and a.ctid > b.ctid;

-- 3) 앞으로 같은 이름+모델 중복 등록 방지
create unique index if not exists parts_name_model_uniq
  on public.parts (name, model);
