// 납품 전 체크리스트 항목 정의 (엑셀 원본 기준)
// kind: "check" = 체크만 / "value" = 값 입력 / "choice" = 선택

export type Row =
  | { key: string; label: string; kind: "check" }
  | { key: string; label: string; kind: "value"; ph?: string }
  | { key: string; label: string; kind: "choice"; options: string[] };

export type Item = {
  no: number;
  title: string;
  desc?: string;
  rows: Row[];
};

export const CHECKLIST: Item[] = [
  {
    no: 1,
    title: "디스플레이 기판 스티커 부착 확인 / 버튼 정상 동작 확인",
    rows: [
      { key: "1_sticker", label: "스티커 부착", kind: "check" },
      { key: "1_button", label: "정상 동작", kind: "check" },
    ],
  },
  {
    no: 2,
    title: "자동모드 공정별 시간설정 확인",
    rows: [
      { key: "2_pre", label: "전세척", kind: "value", ph: "예: 60초" },
      { key: "2_disinfect", label: "소독", kind: "value" },
      { key: "2_pump", label: "공급모터", kind: "value" },
      { key: "2_rinse", label: "헹굼", kind: "value" },
      { key: "2_post", label: "후세척", kind: "value" },
      { key: "2_alcohol", label: "알코올", kind: "value" },
      { key: "2_dry", label: "건조", kind: "value" },
    ],
  },
  {
    no: 3,
    title: "수동모드 공정별 시간설정 확인",
    rows: [
      { key: "3_wash", label: "세척", kind: "value" },
      { key: "3_disinfect", label: "소독", kind: "value" },
      { key: "3_pump", label: "공급모터", kind: "value" },
      { key: "3_dry", label: "건조", kind: "value" },
    ],
  },
  {
    no: 4,
    title: "염수보충 시간설정 확인",
    rows: [{ key: "4_brine", label: "설정 시간", kind: "value" }],
  },
  {
    no: 5,
    title: "환경설정 음량설정 최대 확인",
    rows: [{ key: "5_volume", label: "확인", kind: "check" }],
  },
  {
    no: 6,
    title: "자동모드 소독 전체 동작 정상작동 확인",
    desc:
      "전세척: 뚜껑노즐·채널순환 물줄기 확인 (후세척 동일) · 소독: 소독액 공급, 농도(스트립), 채널순환 물줄기 · 헹굼: 헹굼 동작 · 알코올: 설정 시간 동안 실제 투입 · 건조: 내부 건조 동작 · 배수: 정해진 시간 안에 배수",
    rows: [
      { key: "6_pre", label: "전세척", kind: "check" },
      { key: "6_disinfect", label: "소독", kind: "check" },
      { key: "6_rinse", label: "헹굼", kind: "check" },
      { key: "6_post", label: "후세척", kind: "check" },
      { key: "6_alcohol", label: "알코올", kind: "check" },
      { key: "6_dry", label: "건조", kind: "check" },
      { key: "6_drain", label: "배수", kind: "check" },
    ],
  },
  {
    no: 7,
    title: "1회분 소독액 생성 완료 시간 확인",
    rows: [{ key: "7_time", label: "생성 시간", kind: "value" }],
  },
  {
    no: 8,
    title: "소독/헹굼 공정 초음파 작동 확인",
    rows: [
      { key: "8_disinfect", label: "소독", kind: "check" },
      { key: "8_rinse", label: "헹굼", kind: "check" },
    ],
  },
  {
    no: 9,
    title: "수동모드 각 공정 정상작동 확인",
    rows: [
      { key: "9_wash", label: "세척", kind: "check" },
      { key: "9_disinfect", label: "소독", kind: "check" },
      { key: "9_dry", label: "건조", kind: "check" },
    ],
  },
  {
    no: 10,
    title: "전해조 내부 확인 (이물질 유무, 흰거품)",
    rows: [
      {
        key: "10_cell",
        label: "상태",
        kind: "choice",
        options: ["정상", "비정상"],
      },
    ],
  },
  {
    no: 11,
    title: "정류기 V, A 확인",
    rows: [
      { key: "11_v", label: "V", kind: "value", ph: "전압" },
      { key: "11_a", label: "A", kind: "value", ph: "전류" },
    ],
  },
  { no: 12, title: "1단 전체 누수 확인", rows: [{ key: "12", label: "확인", kind: "check" }] },
  { no: 13, title: "2단 전체 누수 확인", rows: [{ key: "13", label: "확인", kind: "check" }] },
  { no: 14, title: "3단 전체 누수 확인", rows: [{ key: "14", label: "확인", kind: "check" }] },
  {
    no: 15,
    title: "소독액 공급모터 누수 확인",
    rows: [{ key: "15", label: "확인", kind: "check" }],
  },
  {
    no: 16,
    title: "전기분해장치 입출구 누수 확인",
    rows: [
      { key: "16_in", label: "입구", kind: "check" },
      { key: "16_out", label: "출구", kind: "check" },
    ],
  },
  { no: 17, title: "급수모터 누수 확인", rows: [{ key: "17", label: "확인", kind: "check" }] },
  {
    no: 18,
    title: "수조 수위조절 센서 누수 확인",
    rows: [{ key: "18", label: "확인", kind: "check" }],
  },
  {
    no: 19,
    title: "공기누수체크 동작 확인",
    rows: [{ key: "19", label: "확인", kind: "check" }],
  },
  {
    no: 20,
    title: "수중누수체크 동작 확인",
    rows: [{ key: "20", label: "확인", kind: "check" }],
  },
  { no: 21, title: "에어건 동작 확인", rows: [{ key: "21", label: "확인", kind: "check" }] },
  {
    no: 22,
    title: "수조 인터락 시간/동작 확인",
    rows: [
      { key: "22_time", label: "시간", kind: "value" },
      { key: "22_ok", label: "동작", kind: "check" },
    ],
  },
  {
    no: 23,
    title: "염수통 인터락 시간/동작 확인",
    rows: [
      { key: "23_time", label: "시간", kind: "value" },
      { key: "23_ok", label: "동작", kind: "check" },
    ],
  },
  {
    no: 24,
    title: "소독액통 인터락 동작 확인",
    rows: [{ key: "24", label: "확인", kind: "check" }],
  },
  {
    no: 25,
    title: "PCB 보호 아크릴판 장착 확인",
    rows: [{ key: "25", label: "확인", kind: "check" }],
  },
  {
    no: 26,
    title: "소독 카운트 기록 확인",
    rows: [{ key: "26_count", label: "소독 카운트", kind: "value" }],
  },
  { no: 27, title: "소독액 배출 확인", rows: [{ key: "27", label: "확인", kind: "check" }] },
  { no: 28, title: "뚜껑 스티커 부착 확인", rows: [{ key: "28", label: "확인", kind: "check" }] },
  {
    no: 29,
    title: "디스플레이 커버 부착 확인",
    rows: [{ key: "29", label: "확인", kind: "check" }],
  },
];

export const ALL_KEYS: string[] = CHECKLIST.flatMap((i) => i.rows.map((r) => r.key));

// 작성 완료 여부: 모든 항목이 채워졌는지
export function filledCount(data: Record<string, unknown>): number {
  return ALL_KEYS.filter((k) => {
    const v = data?.[k];
    if (typeof v === "boolean") return v;
    return typeof v === "string" && v.trim() !== "";
  }).length;
}
