import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function H({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[16px] font-bold mt-8 mb-2 pb-1.5 border-b border-line">
      {children}
    </h2>
  );
}
function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 my-1.5">
      <span className="shrink-0 w-5 h-5 rounded-full bg-accent text-white text-[11px] font-bold grid place-items-center mt-0.5">
        {n}
      </span>
      <span className="text-[13.5px] text-ink-2 leading-relaxed">{children}</span>
    </div>
  );
}
function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-accent-bg text-accent-ink text-[12.5px] rounded-lg px-3.5 py-2.5 my-2 leading-relaxed">
      💡 {children}
    </div>
  );
}

export default async function HelpPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: prof } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id ?? "")
    .maybeSingle();
  const isDealer = prof?.role === "dealer";

  return (
    <div className="max-w-[720px]">
      <h1 className="text-xl font-bold mb-1">사용 안내</h1>
      <p className="text-[13px] text-ink-3 mb-2">
        포오랩(Four-O LAB) 사내 공유 시스템 사용설명서
        {isDealer ? " — 대리점용" : ""}
      </p>
      <p className="text-[12px] text-ink-3 mb-4">
        종이로 필요하면 이 화면에서 <b>Ctrl+P</b>(인쇄)를 누르세요.
      </p>

      <H>시작하기</H>
      <Step n={1}>
        <b>접속 주소</b>: <span className="font-mono text-[12.5px]">fourolab-app-private.vercel.app</span>{" "}
        — 폰·PC 어디서나 브라우저로 접속합니다.
      </Step>
      <Step n={2}>
        <b>로그인</b>: 관리자(본사)에게 받은 이메일과 비밀번호를 입력합니다.
        직접 가입은 불가능하며, 계정은 관리자가 발급합니다.
      </Step>
      <Step n={3}>
        <b>폰 홈 화면에 추가</b>하면 앱처럼 쓸 수 있습니다 — 아이폰: 공유
        버튼(⬆) → &ldquo;홈 화면에 추가&rdquo; / 안드로이드: 브라우저 메뉴(⋮) →
        &ldquo;홈 화면에 추가&rdquo;.
      </Step>
      <Tip>
        폰에서는 화면 아래 탭(홈 · A/S · 기기 · 병원 · 전체)으로 이동하고,
        PC에서는 왼쪽 메뉴를 사용합니다. 비밀번호를 잊으면 관리자에게 재발급을
        요청하세요.
      </Tip>

      {!isDealer && (
        <>
          <H>A/S 접수하기 (가장 자주 쓰는 기능)</H>
          <Step n={1}>왼쪽 메뉴(폰: 아래 탭) <b>A/S 관리</b>로 이동합니다.</Step>
          <Step n={2}>
            오른쪽 <b>A/S 접수 등록</b>에서 <b>대상 기기</b>를 선택합니다
            (기기번호·병원이 자동으로 붙습니다).
          </Step>
          <Step n={3}>
            <b>접수자</b>(병원 쪽에서 연락 준 사람)를 ＋로 추가하고, 증상을
            적습니다.
          </Step>
          <Step n={4}>
            <b>수리 내용·사유(사내 코멘트)</b>에 어떻게·왜 수리했는지 기록합니다
            — 나중에 같은 증상이 오면 큰 도움이 됩니다.
          </Step>
          <Step n={5}>
            <b>교체 부품</b> 칸을 클릭해 부품을 여러 개 선택하고 수량을
            정합니다. <b>등록하면 부품 재고가 자동으로 차감</b>됩니다.
          </Step>
          <Step n={6}>
            진행 전·후 사진, 층별(1·2·3층) 점검 사진을 ＋버튼으로 첨부하고{" "}
            <b>A/S 접수 등록</b>을 누릅니다.
          </Step>
          <Step n={7}>
            수리가 끝나면 목록에서 <b>완료</b> 버튼을 누르세요. 내용을 고치려면{" "}
            <b>수정</b>을 누릅니다.
          </Step>

          <H>병원 관리</H>
          <Step n={1}>
            <b>병원 관리</b>에서 병원을 등록합니다 — 담당자는 ＋로 여러 명
            (간호사·수간호사·구매팀 등) 추가할 수 있고, 설치 환경 사진도
            첨부합니다.
          </Step>
          <Step n={2}>
            병원 <b>이름을 클릭</b>하면 그 병원의 납품 기기·A/S 이력·정기점검이
            한 화면에 보입니다.
          </Step>
          <Step n={3}>
            병원 상세의 정기점검 줄에서 <b>일정에 등록</b>을 누르면 다음
            점검일(납품일+3개월 자동)이 일정에 올라갑니다.
          </Step>

          <H>기기 등록 · 기기 현황</H>
          <Step n={1}>
            새 기기를 만들면 <b>기기 등록</b>에서 고유번호·모델·구분(완성품 등)을
            등록합니다. 납품하면 수정에서 <b>납품일·위치 병원</b>을 지정하세요.
          </Step>
          <Step n={2}>
            <b>기기 번호를 클릭</b>하면 그 기기의 전체 이력(생산→납품→A/S→대리점)
            타임라인이 보입니다.
          </Step>
          <Step n={3}>
            <b>기기 현황</b>에서는 완성품·데모·전시·A/S·납품 대수를 모델별로 한눈에
            봅니다. 데모 나간 기기는 <b>회수</b> 버튼(사용자 코멘트 입력)으로
            완성품 재고로 되돌립니다.
          </Step>
          <Step n={4}>
            완성품 테스트 중 부품을 교체하면 테스트 보드의 <b>부품 교체</b>로
            기록하세요 — 부품 재고가 자동 차감되고 기기 이력에 남습니다.
          </Step>

          <H>재고·생산</H>
          <Step n={1}>
            <b>재고·생산</b>에서 부품을 등록합니다 (모델·1기당 소요·현재고·구매
            링크). ★을 누르면 즐겨찾기 — A/S 부품 선택에서 위에 표시됩니다.
          </Step>
          <Step n={2}>
            상단에 <b>제작 가능 완성품 대수</b>와 병목 부품이 자동 계산됩니다.
            부족 부품은 <b>부족품 구매링크 모음</b>에서 바로 주문하세요.
          </Step>
          <Step n={3}>
            부품을 주문하면 <b>발주 등록</b>, 물건이 오면 <b>도착 처리</b> —
            재고가 자동으로 늘어납니다. 불량·수량 불일치는 <b>불량·로스 등록</b>
            (재고 자동 차감).
          </Step>

          <H>대리점 관리</H>
          <Step n={1}>
            거래처 등록 후, 기기를 보내면 <b>기기 발송 등록</b>(완성품/데모용
            구분), 대리점이 병원에 납품하면 <b>병원 출고 등록</b>.
          </Step>
          <Step n={2}>
            정제염·필터 등을 보낼 땐 <b>소모품 발송 등록</b> — 본사 재고는 줄고{" "}
            <b>그 대리점 재고로 자동 이동</b>합니다.
          </Step>
          <Step n={3}>
            대리점이 직접 올린 정기점검·A/S·납품 기록은{" "}
            <b>대리점 사후관리</b>에서 확인합니다.
          </Step>

          <H>전시·일정</H>
          <Step n={1}>
            <b>이벤트 등록</b>에서 정기점검·A/S 방문·데모·설치·전시 등을
            등록합니다. 이벤트명을 쓰면 그 이름이 달력에 표시됩니다.
          </Step>
          <Step n={2}>
            기기가 나가는 일정이면 <b>＋ 출고 기기 추가</b>로 모델·구분(완제품/
            전시용)·대수를 적으세요 — 기기 현황에 출고 예정으로 집계되고, 재고가
            부족하면 몇 대 더 만들어야 하는지 알려줍니다.
          </Step>
          <Step n={3}>
            직원 연차·휴가·교육·출장은 <b>근태 등록</b>에 기간과 시간을 넣습니다.
          </Step>

          <H>기타 기능</H>
          <Step n={1}>
            <b>통합 검색</b> — 기기번호·병원·증상·부품명으로 한 번에 찾기.
          </Step>
          <Step n={2}>
            <b>엑셀 내보내기</b> — A/S·기기·병원·부품 목록 위의 버튼으로 CSV
            다운로드 (백업 겸용, 주 1회 권장).
          </Step>
          <Step n={3}>
            <b>수정 이력</b> — 누가 언제 무엇을 등록·수정·삭제했는지 확인.
          </Step>
        </>
      )}

      <H>{isDealer ? "사후관리 기록 올리기" : "대리점 계정 안내 (대리점에 전달용)"}</H>
      <Step n={1}>
        로그인하면 <b>대리점 사후관리</b> 화면만 보입니다. 우리 대리점의 기록과
        재고만 표시됩니다.
      </Step>
      <Step n={2}>
        병원에 <b>정기점검</b>이나 <b>A/S</b>를 다녀오면: 유형 선택 → 병원·기기
        번호(받은 기기 목록에서 선택) → <b>점검 사항·교체 사항</b> 작성 →{" "}
        <b>현장 사진 첨부</b>(필수에 가깝게 권장) → 기록 등록.
      </Step>
      <Step n={3}>
        본사에서 받은 기기를 병원에 <b>납품</b>하면: 유형을 &ldquo;납품&rdquo;으로
        선택하고 기기 번호·병원·설치 사진을 올립니다.
      </Step>
      <Step n={4}>
        부품(정제염 등)을 사용하면 <b>사용/교체 부품</b>에서 선택하고 수량을
        적으세요 — 대리점 재고에서 자동 차감됩니다. 화면 위에서 남은 재고를
        확인할 수 있습니다.
      </Step>
      <Step n={5}>
        고장 부품을 본사로 보낼 땐 <b>&ldquo;고장 부품 본사 발송&rdquo; 체크</b>{" "}
        후 부품명·택배 정보를 적습니다.
      </Step>
      <Tip>
        정기점검은 필수입니다 — 다녀올 때마다 사진과 함께 꼭 기록해 주세요.
        본사에서 실시간으로 확인합니다.
      </Tip>

      <H>자주 묻는 질문</H>
      <div className="text-[13.5px] text-ink-2 leading-relaxed flex flex-col gap-2.5">
        <p>
          <b>Q. 비밀번호를 잊었어요.</b>
          <br />→ 관리자(본사)에게 재발급을 요청하세요.
        </p>
        <p>
          <b>Q. 잘못 입력했어요.</b>
          <br />→ 각 목록의 <b>수정</b> 버튼으로 고칠 수 있습니다. 삭제도 수정
          화면에서 가능합니다.
        </p>
        <p>
          <b>Q. 방금 남이 입력한 게 안 보여요.</b>
          <br />→ 화면을 새로고침(아래로 당기기 / F5)하면 반영됩니다.
        </p>
        <p>
          <b>Q. 사진이 안 올라가요.</b>
          <br />→ 인터넷 연결을 확인하고 다시 시도하세요. 계속 안 되면 관리자에게
          알려주세요.
        </p>
        <p>
          <b>Q. &ldquo;서버 연결에 실패했습니다&rdquo;가 떠요.</b>
          <br />→ 인터넷(Wi-Fi/데이터)을 확인하고, 회사 네트워크라면 다른
          네트워크로 시도해 보세요.
        </p>
      </div>

      <p className="text-[12px] text-ink-3 mt-8 pb-4">
        포오랩(Four-O LAB) 사내 공유 시스템 · 문의는 관리자에게
      </p>
    </div>
  );
}
