-- ============================================================
--  실제 운영 데이터 등록 (테스트 데이터 전체 삭제 후 입력)
--  ※ 부품(parts) 자재 131종은 유지됩니다.
--  Supabase > SQL Editor 에 붙여넣고 Run 하세요. (편집기 비우고)
-- ============================================================

-- ── 1) 테스트 데이터 정리 (부품 제외) ────────────────────────
delete from public.checklists;
delete from public.aftercare;
delete from public.dealer_stock;
delete from public.dealer_supplies;
delete from public.dealer_logs;
delete from public.dealers;
delete from public.as_tickets;
delete from public.events;
delete from public.leaves;
delete from public.stock_issues;
delete from public.part_orders;
delete from public.part_quotes;
delete from public.devices;
delete from public.hospitals;
delete from public.audit_log;

-- ── 2) 병원 등록 ────────────────────────────────────────────
insert into public.hospitals (name, addr, biz) values
  ('정동병원',         '서울시 동작구 양녕로 283',                        '본사 직영'),
  ('엘병원',           '경기 남양주시 퇴계원읍 퇴계원로 20',               '본사 직영'),
  ('부천 메디홀스병원', '경기도 부천시 소사구 경인로110번길 18',            '본사 직영'),
  ('메디홀스 요양병원', '경기도 부천시 소사구 경인로110번길 14',            '본사 직영'),
  ('제주 한국병원',    '제주 제주시 서광로 193',                          '본사 직영'),
  ('한신메디피아',     '서울시 서초구 잠원로 94 한신빌딩',                 '본사 직영'),
  ('아산 현대병원',    '충청남도 아산시 온천대로 1442',                    '본사 · 데모'),
  ('다보스병원',       '경기 용인시 처인구 백옥대로1082번길 18',            '본사 · 데모'),
  ('시흥마음속내과',   '경기도 시흥시 정왕대로 230 제일프라자 202-1',       '본사 · 데모'),
  ('울산시티병원',     '울산 북구 산업로 1007',                           '본사 · 데모 예정')
on conflict do nothing;

-- ── 3) 납품 기기 (고유번호는 임시 — 실제 번호로 수정하세요) ──
insert into public.devices (serial, model, category, status, hospital_id)
select v.serial, v.model, '납품', v.status, h.id
from (values
  ('정동-OS1-1',        'OS1', '납품 완료', '정동병원'),
  ('정동-OS1-2',        'OS1', '납품 완료', '정동병원'),
  ('엘병원-OS1-1',      'OS1', '납품 완료', '엘병원'),
  ('부천메디홀스-OS1-1','OS1', '납품 완료', '부천 메디홀스병원'),
  ('메디홀스요양-OS1-1','OS1', '납품 완료', '메디홀스 요양병원'),
  ('메디홀스요양-OS1-2','OS1', '납품 완료', '메디홀스 요양병원'),
  ('제주한국-OS2-1',    'OS2', '납품 완료', '제주 한국병원'),
  ('제주한국-OS2-2',    'OS2', '납품 완료', '제주 한국병원'),
  ('제주한국-OS2-3',    'OS2', '납품 완료', '제주 한국병원'),
  ('한신-OS2-1',        'OS2', '납품 완료', '한신메디피아')
) as v(serial, model, status, hosp)
join public.hospitals h on h.name = v.hosp
on conflict (serial) do nothing;

-- ── 4) 데모 진행 중 기기 ────────────────────────────────────
insert into public.devices (serial, model, category, status, hospital_id)
select v.serial, v.model, '데모', v.status, h.id
from (values
  ('아산현대-OS2-1',   'OS2', '데모 진행 중',            '아산 현대병원'),
  ('다보스-OS2-1',     'OS2', '데모 진행 중 · 검진센터', '다보스병원'),
  ('다보스-OS1-1',     'OS1', '데모 진행 중 · 검진센터', '다보스병원'),
  ('다보스-OS1-2',     'OS1', '데모 진행 중 · 본원 내시경실', '다보스병원'),
  ('시흥마음속-OS2-1', 'OS2', '데모 진행 중',            '시흥마음속내과'),
  ('시흥마음속-OS1-1', 'OS1', '데모 진행 중',            '시흥마음속내과')
) as v(serial, model, status, hosp)
join public.hospitals h on h.name = v.hosp
on conflict (serial) do nothing;

-- ── 5) 일정 등록 (데모/납품 예정 · 전시) ────────────────────
insert into public.events
  (type, title, place, event_date, event_time, end_date, who, memo, out_items, out_qty, out_model)
values
  ('데모 출고', '울산시티병원 데모', '울산시티병원', '2026-08-04', '10:00', null, '',
   '데모 진행 예정 (화요일)',
   '[{"model":"OS2","kind":"완성품","qty":1},{"model":"OS1","kind":"완성품","qty":1}]'::jsonb, 2, ''),

  ('데모 출고', '부산 지역 병원 데모 (병원명 미정)', '부산 지역', null, '', null, '',
   '데모 → 납품 바로 이어지는 구조 예상 · 일정 미정',
   '[{"model":"OS1","kind":"완성품","qty":2}]'::jsonb, 2, 'OS1'),

  ('설치·납품', '시흥마음속내과 납품', '시흥마음속내과', '2026-08-06', '10:00', null, '',
   '기존 데모 장비 회수 후 새 장비 납품 확정 (목요일)',
   '[{"model":"OS2","kind":"완성품","qty":1},{"model":"OS1","kind":"완성품","qty":1}]'::jsonb, 2, ''),

  ('기타', '전시용 OCTA-SELL 2 코리아 GLS 전달', '코리아 GLS', '2026-08-05', '09:00', null, '',
   '독일 MEDICA(11/16~19) 전시용 선적 — 오전 전달 필요',
   '[{"model":"OS2","kind":"전시용","qty":1}]'::jsonb, 1, 'OS2'),

  ('전시·세미나', 'KHF 2026 사전 설치', '서울 코엑스', '2026-08-18', '09:00', null, '',
   '전시용 OCTA-SELL 1 & 2 각 1대 사전 설치',
   '[{"model":"OS1","kind":"전시용","qty":1},{"model":"OS2","kind":"전시용","qty":1}]'::jsonb, 2, ''),

  ('전시·세미나', 'KHF 2026', '서울 코엑스', '2026-08-19', '09:00', '2026-08-21', '', '',
   '[]'::jsonb, 0, ''),

  ('전시·세미나', '추계 대한검진의학회', '', '2026-10-11', '09:00', null, '',
   '전시용 OCTA-SELL 2 (일요일)',
   '[{"model":"OS2","kind":"전시용","qty":1}]'::jsonb, 1, 'OS2'),

  ('전시·세미나', '독일 MEDICA 2026', '독일 뒤셀도르프', '2026-11-16', '09:00', '2026-11-19', '',
   '전시용 OCTA-SELL 2 선적 (8/5 코리아 GLS 전달)',
   '[{"model":"OS2","kind":"전시용","qty":1}]'::jsonb, 1, 'OS2');
