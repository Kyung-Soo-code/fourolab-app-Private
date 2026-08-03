-- ============================================================
--  [수정] A/S 등록 실패 · 사진 업로드 불가 해결
--  누락된 사진 컬럼 + 사진 저장소(photos 버킷) 생성
--  Supabase > SQL Editor 에 붙여넣고 Run 하세요. (편집기 비우고)
--  ※ 여러 번 실행해도 안전합니다.
-- ============================================================

-- 1) 누락된 사진 컬럼 추가
alter table public.as_tickets add column if not exists photos_before jsonb default '[]'::jsonb;
alter table public.as_tickets add column if not exists photos_after  jsonb default '[]'::jsonb;
alter table public.as_tickets add column if not exists photos_f1     jsonb default '[]'::jsonb;
alter table public.as_tickets add column if not exists photos_f2     jsonb default '[]'::jsonb;
alter table public.as_tickets add column if not exists photos_f3     jsonb default '[]'::jsonb;
alter table public.as_tickets add column if not exists customer_comment text default '';
alter table public.hospitals  add column if not exists photos        jsonb default '[]'::jsonb;
alter table public.devices    add column if not exists install_photos jsonb default '[]'::jsonb;
alter table public.events     add column if not exists booth_photos  jsonb default '[]'::jsonb;
alter table public.aftercare  add column if not exists photos        jsonb default '[]'::jsonb;
alter table public.parts      add column if not exists docs          jsonb default '[]'::jsonb;

-- 2) 사진 저장소(버킷) 생성 — 이게 없어서 사진 업로드가 안 됐습니다
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do update set public = true;

-- 3) 저장소 접근 정책 (로그인 직원 업로드 / 공개 읽기)
drop policy if exists "photos read" on storage.objects;
create policy "photos read" on storage.objects
  for select using (bucket_id = 'photos');

drop policy if exists "photos insert" on storage.objects;
create policy "photos insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'photos');

drop policy if exists "photos update" on storage.objects;
create policy "photos update" on storage.objects
  for update to authenticated using (bucket_id = 'photos');

drop policy if exists "photos delete" on storage.objects;
create policy "photos delete" on storage.objects
  for delete to authenticated using (bucket_id = 'photos');

-- 4) 정제염 부품 등록 (대리점 소모품 발송용 · 기기 제작에는 미포함)
insert into public.parts (name, model, category, per_unit, unit, stock, as_type, favorite, note)
values ('정제염', '공용', '소모품', 0, '포', 0, '정기점검', true, '대리점 발송 소모품')
on conflict (name, model, category) do nothing;
