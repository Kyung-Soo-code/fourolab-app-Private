-- ============================================================
--  사진 첨부용 스토리지 + 컬럼 + 정제염 부품 추가
--  Supabase > SQL Editor 에 붙여넣고 Run 하세요.
-- ============================================================

-- 1) 사진 저장용 버킷 (공개 읽기)
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

-- 2) 스토리지 접근 정책 (로그인 직원 업로드 / 공개 읽기)
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

-- 3) 사진 컬럼
alter table public.as_tickets add column if not exists photos_before jsonb default '[]'::jsonb;
alter table public.as_tickets add column if not exists photos_after  jsonb default '[]'::jsonb;
alter table public.hospitals  add column if not exists photos        jsonb default '[]'::jsonb;

-- 4) 정제염을 부품 목록에 추가 (소모품 발송에서 선택)
insert into public.parts (name, model, vendor, per_unit, stock, as_type, favorite)
values ('정제염', '공용', '', 0, 100, '정기점검', true)
on conflict (name, model) do nothing;
