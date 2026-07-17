# 포오랩 사내 공유 시스템 — 설정 가이드

Next.js + Supabase 로 만든 실제 앱입니다. 아래 순서대로 하면 로컬에서 실제 저장·로그인이 동작합니다.

## 1. 데이터베이스 만들기
1. Supabase 대시보드 → 왼쪽 **SQL Editor** 열기
2. `supabase/schema.sql` 파일 내용을 전부 복사해 붙여넣고 **Run**
3. 테이블(profiles, hospitals, devices, as_tickets)과 샘플 데이터가 생성됩니다

## 2. 로그인 계정 만들기
1. Supabase 대시보드 → **Authentication → Users → Add user**
2. 이메일·비밀번호 입력, **Auto Confirm User** 체크 → 생성
3. (직원 수만큼 반복 — 관리자가 계정 발급)

> 이메일 인증 절차를 끄려면: Authentication → Providers → Email → "Confirm email" 끄기(사내용 권장)

## 3. 연결 정보 넣기
1. `.env.local.example` 를 복사해 `.env.local` 로 저장
2. Supabase → Settings → API 에서 **Project URL** 과 **anon public 키**를 붙여넣기

## 4. 실행
```
npm install      # 최초 1회
npm run dev
```
브라우저에서 http://localhost:3000 접속 → 로그인 → 사용

## 5. 나중에 클라우드 배포 (10명 어디서나 접속)
- GitHub 에 코드 올리고 → **Vercel** 에서 연결 → 같은 환경변수 등록 → 자동 배포
- Supabase 는 이미 클라우드이므로 그대로 사용

---
### 구성
- `app/(app)/` — 로그인 후 화면 (대시보드/A/S/기기/병원)
- `app/login/` — 로그인
- `lib/supabase/` — DB 연결
- `supabase/schema.sql` — DB 설계
