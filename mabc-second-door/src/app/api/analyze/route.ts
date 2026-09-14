import { NextRequest, NextResponse } from "next/server";

// ============================================================
// 두번째문(second-door) 규칙 로직
// Vercel 서버리스 함수로 실행 — 키 없이 동작
// ============================================================

/** 메시지에서 전화·URL·계좌·코드·Toss 라벨 등을 범주로만 치환 */
function sanitizeIdentifiers(text: string): string {
  let s = text;

  // URL
  s = s.replace(
    /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi,
    "[링크]",
  );

  // 계정·전화번호 유사 pattern (010-0000-0000, 02-000-0000 등)
  s = s.replace(/\b01[0-9]-\d{3,4}-\d{4}\b/g, "[메시지 속 번호]");
  s = s.replace(/\b0[2-9]?-\d{3,4}-\d{4}\b/g, "[메시지 속 번호]");

  // Toss 라벨 + 연속된 숫자 (계좌번호 유사)
  s = s.replace(
    /\b(Toss|토스|toss)\s*[-·\s]?\d[\d\-\s]*\d\b/gi,
    "[메시지 속 계좌]",
  );
  // 계좌번호처럼 보이는 10~16자리 은행 코드 패턴 (예외적으로 일부만)
  s = s.replace(/\b\d{2,4}[-·\s]\d{2,6}[-·\s]\d{2,6}\b/g, "[메시지 속 계좌]");

  // OTP·일회용 코드 유사: 4~8자리 숫자만 단독
  s = s.replace(/\b\d{4,8}\b/g, (m) => {
    // 이미 치환된 건 건너뛰기
    if (
      m.startsWith("[") ||
      m === "2026" ||
      m === "2025" ||
      m === "2024" ||
      m === "2023" ||
      m === "1234" // 예시 프리셋과 겹치지 않도록
    )
      return m;
    return "[코드]";
  });

  // 경찰청·금감원 공개 사례에서 자주 등장하는 suspicious 패턴 보강
  // "고객님" 호칭 + 계좌/송금 요구 조합 (보이스피싱 전형)
  if (/고객님|고객\s*님/i.test(text)) {
    s = s.replace(
      /(고객님|고객\s*님)/gi,
      "[발신자 표시]",
    );
  }

  return s;
}

/**
 * Upstage Document OCR API로 이미지에서 텍스트 추출
 * Workers 런타임: atob, Blob, FormData 지원
 */
async function extractTextFromImage(
  base64Data: string,
  apiKey: string,
  mimeType: string = "image/png",
): Promise<{ text: string; confidence: number | null }> {
  const cleanBase64 = base64Data.replace(/^data:[a-zA-Z]+\/[a-zA-Z]+;base64,/, "");
  const binary = atob(cleanBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  const formData = new FormData();
  formData.append("document", blob, "image.png");
  formData.append("model", "ocr");

  const res = await fetch("https://api.upstage.ai/v1/document-digitization", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });
  if (!res.ok) {
    throw new Error(`OCR API 오류: ${res.status}`);
  }
  const data = (await res.json()) as {
    text?: string;
    confidence?: number;
  };
  return {
    text: data.text ?? "",
    confidence: data.confidence ?? null,
  };
}

/** 금지 출력 패턴 검사: 이 서비스의 출력에 포함되어서는 안 되는 것 */
function checkProhibitedOutput(fields: Record<string, string>): string[] {
  const prohibited: string[] = [];

  const allText = Object.values(fields).join(" ");

  // 진위·사기·진짜·가짜·안전 판정(명사형)
  if (/\b(사기|진짜|가짜|안전[합니다]?|위[험합니다]?|피싱|스미싱|보이스피싱)\b/i.test(allText)) {
    prohibited.push("진위/사기/안전 판정 어휘");
  }

  // 점수·확률·%
  if (/\d+(\.\d+)?\s*[%％]/.test(allText) || /\b확률|신뢰도|점수|퍼센트\b/i.test(allText)) {
    prohibited.push("점수/확률/%");
  }

  // 긴급·기관 번호 숫자 (112, 119, 1332, 1366, 1398, 1345 등)
  if (
    /\b112\b|\b119\b|\b1332\b|\b1366\b|\b1398\b|\b1345\b/.test(allText)
  ) {
    prohibited.push("긴급·기관 번호 숫자");
  }

  // 복구·환불·배상·보상 약속
  if (
    /\b(환불|복구|배상|보상|되돌림|원상|보장[합니다]?|예정[입니다]?)\b/i.test(allText)
  ) {
    prohibited.push("복구/환불/배상/보장 약속");
  }

  return prohibited;
}

// ---- 공공데이터 출처·유형·예방 참고 정보 ----
// 판정 어휘 없이, 멈추고 확인하는 절차를 돕는 참고 자료 성격
// 출처는 공공데이터-sources.md 기준 검증된 것만 사용

const FRAUD_TYPE_TAGS = [
  { tag: "대출알선형", keywords: ["대출", "한도", "신용", "등급", "추가대출", "대환"], source: "official" },
  { tag: "가짜 검찰청·위조 수사공문형", keywords: ["검찰", "법원", "경찰", "출석", "수사", "공문", "혐의", "고발", "조사"], source: "official" },
  { tag: "자녀 납치 빙자 협박형", keywords: ["납치", "괜찮아", "살려", "아이", "자녀", "손자", "다쳤다", "위험"], source: "official" },
  { tag: "가족·지인 사칭 메신저피싱", keywords: ["엄마", "아빠", "부모", "가족", "친구", "딸", "아들", "언니", "오빠", "형", "누나"], source: "official" },
  { tag: "정부기관 사칭형", keywords: ["정부", "관공서", "시청", "구청", "국세청", "건강보험", "연금", "행정", "세금", "기관"], source: "official" },
  { tag: "정부지원 대출·채무조정 빙자형", keywords: ["정부지원", "채무", "조정", "채무조정", "햇살론", "새희망", "미소금융", "서민금융"], source: "derived" },
  { tag: "악성앱 설치 유도형", keywords: ["설치", "앱", "다운로드", "실행", "업데이트", "백신", "보안", "보호앱", "원격", "화면"], source: "official" },
  { tag: "투자리딩방·로맨스스캠 등 신종스캠형", keywords: ["투자", "리딩", "수익률", "코인", "주식", "수익", "VIP", "단톡", "오픈채팅"], source: "derived" },
];

const PREVENTION_TIPS = [
  { tip: "메시지 속 번호·링크·계좌는 쓰지 말고, 이미 알고 있던 공식·가족 경로로만 확인하세요.", source: "official" },
  { tip: "급하다는 말과 금전 요구가 함께 오면, 바로 움직이지 말고 이미 알던 경로로 먼저 확인하세요.", source: "derived" },
  { tip: "새 연락처·계좌·채널 변경 주장은 메시지 전에 알던 경로로 사실 여부를 먼저 확인하세요.", source: "derived" },
  { tip: "메시지 하나로 바로 결론 내리지 말고, 필요한 경우 이미 알고 있던 경로로 확인하세요.", source: "derived" },
  { tip: "이미 무언가(입금·이체·인증·설치 등)를 했다면, 추가 행동 전에 공식 채널로 확인하세요.", source: "derived" },
];

const DATA_SOURCES = [
  { name: "금융감독원 보이스피싱 예방안내", url: "https://www.fss.or.kr/fss/main/sub1voice.do?menuNo=200012", source: "official" },
  { name: "금융감독원 사기유형별 통계", url: "https://www.fss.or.kr/fss/main/contents.do?menuNo=200565", source: "official" },
  { name: "국가정보원·경찰청 보이스피싱 8대 사기유형", url: "https://www.counterscam112.go.kr/campaign/index.html", source: "official" },
  { name: "금융감독원·삼성생명 소비자경보", url: "https://www.samsunglife.com", source: "derived" },
  { name: "경찰청 전기통신금융사기 통합신고대응센터", url: "https://www.police.go.kr", source: "official" },
  { name: "금융감독원·KDI 보이스피싱 피해자 설문조사(2021.06.30)", url: "https://www.kdi.re.kr", source: "derived" },
  { name: "금융위원회 보이스피싱 대응 간담회(2026.03.26)", url: "https://www.fsc.go.kr", source: "derived" },
];

function buildPublicDataInfo(
  message: string,
  branch: string,
  hasCustomerTitle: boolean,
  hasFamily: boolean,
  hasOrg: boolean,
): {
  dataSources: { name: string; url: string; source: string }[];
  fraudTypeTags: { tag: string; source: string }[];
  preventionTips: { tip: string; source: string }[];
  scenarioNote: string;
} {
  const tags: { tag: string; source: string }[] = [];
  const lower = message.toLowerCase();

  for (const ft of FRAUD_TYPE_TAGS) {
    if (ft.keywords.some((k) => lower.includes(k))) {
      tags.push({ tag: ft.tag, source: ft.source });
    }
  }

  // 고객님 호칭 + 계좌/송금 → 대출알선형·정부기관 사칭형 가능성 참고
  if (hasCustomerTitle && /(이체|송금|입금|계좌|은행|금융)/i.test(message)) {
    if (!tags.some((t) => t.tag === "대출알선형")) {
      tags.push({ tag: "대출알선형 (고객님 호칭 + 계좌 요구 패턴 참고)", source: "derived" });
    }
    if (!tags.some((t) => t.tag === "정부기관 사칭형")) {
      tags.push({ tag: "정부기관 사칭형 (고객님 호칭 패턴 참고)", source: "derived" });
    }
  }

  // 가족·지인 사칭 키워드 → 해당 유형 참고
  if (hasFamily && /(급[합니다]?|당장|지금|바로|돈|금액|계좌|송금|입금)/i.test(message)) {
    if (!tags.some((t) => t.tag === "가족·지인 사칭 메신저피싱")) {
      tags.push({ tag: "가족·지인 사칭 메신저피싱 (가족 호출 + 금전 요구 패턴 참고)", source: "derived" });
    }
  }

  // 기관 사칭 키워드 + 압박 → 정부기관 사칭형 참고
  if (hasOrg && /(비밀|함부로|절대|말하지|알려지면|혼자|조용히|급[합니다]?|지금 당장|바로|빨리|늦으면|기회|마지막|오늘 안|지금만|긴급|중요|사망|사고|입원|구속|체포|경찰|법원|소송|출석|출석요구|수사|조사)/i.test(message)) {
    if (!tags.some((t) => t.tag === "정부기관 사칭형")) {
      tags.push({ tag: "정부기관 사칭형 (기관 호출 + 비밀·압박 패턴 참고)", source: "derived" });
    }
  }

  // 중복 제거 (같은 tag가 여러 번 붙는 경우)
  const seen = new Set<string>();
  const uniqueTags = tags.filter((t) => {
    if (seen.has(t.tag)) return false;
    seen.add(t.tag);
    return true;
  });

  // 예방 팁: 분기·키워드에 따라 관련 팁 선별
  const tips: { tip: string; source: string }[] = [];
  const tipAdded = new Set<string>();

  if (branch === "즉시중지") {
    for (const pt of PREVENTION_TIPS) {
      if (!tipAdded.has(pt.tip)) {
        tips.push({ tip: pt.tip, source: pt.source });
        tipAdded.add(pt.tip);
      }
    }
  } else if (branch === "먼저확인") {
    for (const pt of PREVENTION_TIPS) {
      if (pt.tip.includes("새 연락처") || pt.tip.includes("새 연락처")) {
        if (!tipAdded.has(pt.tip)) {
          tips.push({ tip: pt.tip, source: pt.source });
          tipAdded.add(pt.tip);
        }
      }
    }
    // 기본 팁도 추가
    if (!tipAdded.has(PREVENTION_TIPS[0].tip)) {
      tips.push({ tip: PREVENTION_TIPS[0].tip, source: PREVENTION_TIPS[0].source });
      tipAdded.add(PREVENTION_TIPS[0].tip);
    }
  } else {
    // 일반: 기본 팁 2개
    if (!tipAdded.has(PREVENTION_TIPS[0].tip)) {
      tips.push({ tip: PREVENTION_TIPS[0].tip, source: PREVENTION_TIPS[0].source });
      tipAdded.add(PREVENTION_TIPS[0].tip);
    }
    if (!tipAdded.has(PREVENTION_TIPS[3].tip)) {
      tips.push({ tip: PREVENTION_TIPS[3].tip, source: PREVENTION_TIPS[3].source });
      tipAdded.add(PREVENTION_TIPS[3].tip);
    }
  }

  // 시나리오 노트: 분기 + 고객님 호칭 + 가족/기관 여부에 따라 요약
  let scenarioNote = "";
  if (!message.trim()) {
    scenarioNote = "메시지가 없어 참고 정보를 정리할 수 없습니다. 의심되는 메시지 원문을 넣어 주세요.";
  } else if (branch === "즉시중지") {
    if (hasCustomerTitle) {
      scenarioNote = "이 메시지에는 '고객님' 등 조직 발신자 표시와 계좌·송금 요구가 함께 보입니다. 금융감독원·경찰청 공개 사례에서 이런 조합은 보이스피싱 전형 패턴으로 자주 언급됩니다. 출처: 금융감독원 보이스피싱 예방안내(fss.or.kr), 국가정보원·경찰청 8대 사기유형.";
    } else if (hasFamily) {
      scenarioNote = "이 메시지에는 가족·지인 호출과 금전 요구가 함께 보입니다. 가족·지인 사칭 메신저피싱 유형으로 분류될 수 있는 패턴입니다. 출처: 국가정보원·경찰청 보이스피싱 8대 사기유형.";
    } else if (hasOrg) {
      scenarioNote = "이 메시지에는 정부기관·기관 사칭과 압박·비밀 요구가 함께 보입니다. 정부기관 사칭형 패턴으로 분류될 수 있습니다. 출처: 금융감독원·경찰청 공개 사례.";
    } else {
      scenarioNote = "이 메시지는 이체·자격증명·링크·설치·원격접속·비밀압박 또는 이미 한 행동 신호가 있어 즉시중지로 분류되었습니다. 금융감독원·경찰청 공개 사례에서 이런 신호들이 함께 나타날 때 주의가 필요하다고 안내합니다. 출처: 금융감독원 보이스피싱 예방안내(fss.or.kr), 국가정보원·경찰청 8대 사기유형.";
    }
  } else if (branch === "먼저확인") {
    scenarioNote = "이 메시지는 연락처·번호·계좌·채널 변경 주장이 있으나 이체·자격증명·링크·설치·원격접속·비밀압박은 보이지 않아 먼저확인으로 분류되었습니다. 금융감독원·경찰청 안내에 따르면 연락처 변경 주장은 메시지 전에 이미 알고 있던 경로로 사실 여부를 먼저 확인하는 것이 권장됩니다. 출처: 금융감독원 보이스피싱 예방안내(fss.or.kr).";
  } else {
    scenarioNote = "이 메시지는 읽을 수 있는 메시지이나 즉시중지·먼저확인 신호가 뚜렷하지 않아 일반으로 분류되었습니다. 금융감독원·경찰청 안내에 따르면 메시지 하나로 바로 결론 내리지 말고, 필요한 경우 이미 알고 있던 경로로 확인하는 것이 권장됩니다. 출처: 금융감독원 보이스피싱 예방안내(fss.or.kr).";
  }

  return {
    dataSources: DATA_SOURCES,
    fraudTypeTags: uniqueTags,
    preventionTips: tips,
    scenarioNote,
  };
}

/** 7개 필드 생성 */
function buildFields(raw: string): {
  fields: Record<string, string>;
  publicDataInfo: ReturnType<typeof buildPublicDataInfo>;
  branch: string;
} {
  const message = raw.trim();
  const sanitized = sanitizeIdentifiers(message);

  // 분석에 필요한 키워드 탐지를 미리 계산 (공공데이터 정보용)
  const hasCustomerTitle = /고객님|고객\s*님/i.test(message);
  const hasFamily =
    /(아들|딸|엄마|아빠|부모|자녀|가족|형|누나|오빠|언니|남동생|여동생|친척|조카)/i.test(message);
  const hasOrg =
    /(은행|카드사|통신사|택배|경찰서|법원|관공서|시청|구청|우체국|학교|회사|보험사|병원|법원|경찰|소방|정부|행정|세금|국세청|건강보험|연금)/i.test(message);

  // --- 분기 선택 (즉시중지 > 먼저확인 > 일반 > 입력필요) ---
  let branch: string;
  let branchReason: string;

  if (!message) {
    branch = "입력필요";
    branchReason =
      "메시지가 비어 있어 판단할 내용이 없으므로 입력필요로 둡니다.";
  } else {
    // 즉시중지 신호: 이체·자격증명·링크·설치·원격접속·비밀·압박·완료행동
    const lower = message.toLowerCase();

    const hasTransfer =
      /(이체|송금|입금|보내(어|주세요|줘|줄래|줄 수|줄까|주|드리|줄)|계좌|통장|은행|금융|정산|수금|납부|결제|송금해|이체해|보내줘|보내줄)/i.test(
        message,
      ) && /(돈|금액|급[합니다]?|당장|지금|바로|오늘|어제|병원비|빌려|대출|상환|외상|만원|원|필요)/i.test(
        message,
      );

    const hasCredential =
      /(비밀번호|인증번호|보안카드|OTP|일회용|인증[번호코드]|계정|아이디|로그인|확인[번호코드]|본인[인증확인])/i.test(
        message,
      );

    const hasLinkInstall =
      /(https?:\/\/|www\.)/i.test(message) &&
      /(입력|설치|다운로드|실행|열어|클릭|접속|확인[하세요하]|로그|인증|보호[앱프로그램]|업데이트|백신|보안[프로그램앱])/i.test(
        message,
      );

    const hasRemote =
      /(원격|원격제어|팀뷰어|AnyDesk|애니데스크|화면공유|접속|제어|조종|접속|연결|해킹|보기|관찰|감시)/i.test(
        message,
      );

    const hasSecretPressure =
      /(비밀|함부로|절대|누구에게도|말하지|밖에|다른사람|알려지면|혼자|조용히|급[합니다]?|지금 당장|바로|빨리|늦으면|기회|마지막|오늘 안|지금만|긴급|중요[합니다]?|사망|사고|입원|구속|체포|경찰|법원|소송|출석|출석요구|수사|조사)/i.test(
        message,
      );

    const hasActionDone =
      /(이미|벌써|방금|아까|전에|완료|끝났[습니다]?|보냈[습니다]?|입금[했습니했]?(어요|다)|보냈어요|(송금|이체|인증)[했습니했]?)/i.test(
        message,
      );

    if (
      hasTransfer ||
      hasCredential ||
      hasLinkInstall ||
      hasRemote ||
      hasSecretPressure ||
      hasActionDone ||
      hasCustomerTitle
    ) {
      branch = "즉시중지";
      const reasons: string[] = [];
      if (hasTransfer) reasons.push("이체/송금 관련 요청");
      if (hasCredential) reasons.push("자격증명·인증 정보 요구");
      if (hasLinkInstall) reasons.push("링크·설치 요구");
      if (hasRemote) reasons.push("원격접속·제어 요구");
      if (hasSecretPressure) reasons.push("비밀·급한 압박");
      if (hasActionDone) reasons.push("이미 행동이 있었을 가능성");
      if (hasCustomerTitle) reasons.push("'고객님' 등 조직 발신자 표시 및 계좌·송금 요구");

      // reasons가 비어있으면 hasCustomerTitle 전용 텍스트로 폴백
      branchReason =
        reasons.length > 0
          ? reasons.join("·") + "이(가) 있어 검증 전 상태로 둡니다."
          : "메시지 속 '고객님' 등 조직 발신자 표시가 있어 검증 전 상태로 둡니다.";
    } else if (
      // 먼저확인: 번호·계좌·연락처·채널을 바꾸지만 즉시중지 신호는 없음
      /(바꿨[어다]|바뀌[었었]어|번호|연락처|전화|카톡|문자|이메일|주소|채널|계좌|새[번호전화]|이[번호번]|앞[으로]로|이제[부터는부터는]|연락[해다오세요]|연락드려|연락주세요|연락바랍니다)/i.test(
        message,
      )
    ) {
      branch = "먼저확인";
      branchReason =
        "메시지에 연락처·번호·계좌·채널 변경 주장이 있으나 이체·자격증명·링크·설치·원격접속·비밀압박은 보이지 않아 먼저확인으로 둡니다.";
    } else {
      branch = "일반";
      branchReason =
        "읽을 수 있는 메시지이나 즉시중지·먼저확인 신호가 뚜렷하지 않아 일반으로 둡니다.";
    }
  }

  // --- 7개 필드 ---
  const fields: Record<string, string> = {};

  // 1. 상태
  fields["상태"] = "검증전";

  // 2. 중단조치
  if (branch === "즉시중지") {
    fields["중단조치"] =
      "이 메시지를 근거로 추가 행동(이체·응답·링크 열기·설치·원격접속·추가 검색)을 멈추세요. 메시지 속 계좌·번호·링크는 절대 쓰지 마세요. 이미 무언가 했다면, 메시지 전에 이미 알고 있던 공식·가족 경로로만 확인하세요.";
  } else if (branch === "먼저확인") {
    fields["중단조치"] =
      "메시지에 나온 새 번호·계좌·링크·채널을 그대로 믿지 말고, 메시지 전에 이미 알고 있던 경로로 바꾸려는 내용이 맞는지 먼저 확인하세요. 함부로 연락 경로를 바꾸지 마세요.";
  } else if (branch === "일반") {
    fields["중단조치"] =
      "급하게 결론 내리지 말고, 필요한 경우 이미 알고 있던 경로로 확인하세요. 메시지 하나로 바로 행동하지 마세요.";
  } else {
    fields["중단조치"] =
      "무엇을 분석할지 알려주세요. 최소 한 줄 이상, 확인할 메시지가 있어야 도움을 드릴 수 있습니다.";
  }

  // 3. 확인할주장
  if (!message) {
    fields["확인할주장"] = "주어진 메시지가 없어 확인할 주장을 정리할 수 없습니다. 의심되는 메시지 원문을 넣어 주세요.";
  } else {
    const claimCandidates: string[] = [];
    if (/(급[합니다]?|당장|지금|바로|오늘|병원비|입원|사고|사망|응급|수술|치료|약|빚|대출|상환|외상|돈|금액)/i.test(message))
      claimCandidates.push("\"급함·금전 요구\" 주장");
    if (/(아들|딸|엄마|아빠|부모|자녀|조카|친구|동료|선배|후배|가족|형|누나|오빠|언니|남동생|여동생|친척|지인)/i.test(message))
      claimCandidates.push("\"관계·발신자\" 주장");
    if (/(계좌|은행|입금|송금|이체|통장|금융|정산|수금|납부|결제|카드|현금)/i.test(message))
      claimCandidates.push("\"계좌·이체\" 주장");
    if (/(비밀번호|인증번호|보안|인증|확인[번호코드]|본인[인증확인]|로그인|계정|아이디|OTP)/i.test(message))
      claimCandidates.push("\"자격증명·인증\" 요구");
    if (/(https?:\/\/|www\.|링크|주소|url|클릭|열어|접속|방문)/i.test(message))
      claimCandidates.push("\"링크·접속\" 요구");
    if (/(설치|다운로드|실행|앱|프로그램|업데이트|백신|보안[프로그램앱]|보호[앱프로그램])/i.test(message))
      claimCandidates.push("\"설치·소프트웨어\" 요구");
    if (/(원격|화면|제어|접속|연결|팀뷰어|AnyDesk|애니데스크|공유|보기|관찰|감시|해킹)/i.test(message))
      claimCandidates.push("\"원격접속·제어\" 요구");
    if (/(바꿨[어다]|바뀌[었었]어|번호|연락처|전화|카톡|문자|이메일|주소|채널|새[번호전화]|이[번호번]|앞[으로]로)/i.test(message))
      claimCandidates.push("\"연락처·채널 변경\" 주장");
    if (hasCustomerTitle)
      claimCandidates.push("'고객님' 등 조직 발신자 표시\" 주장");

    if (claimCandidates.length === 0) {
      fields["확인할주장"] =
        "메시지에 구체적인 금전·자격증명·링크·설치·원격접속·연락처 변경 주장이 뚜렷하지 않습니다. 메시지 원문을 기준으로 어떤 주장이 있는지 직접 확인해 보세요.";
    } else {
      fields["확인할주장"] =
        claimCandidates.join("·") +
        " — 이것을 메시지 전에 이미 알고 있던 경로로만 확인하세요.";
    }
  }

  // 4. 독립확인
  if (!message) {
    fields["독립확인"] =
      "메시지가 없어 확인 경로를 정할 수 없습니다. 의심되는 메시지 원문을 넣어 주세요.";
  } else {
    const hasFamily =
      /(아들|딸|엄마|아빠|부모|자녀|가족|형|누나|오빠|언니|남동생|여동생|친척|조카)/i.test(
        message,
      );
    const hasOrg =
      /(은행|카드사|통신사|택배|경찰서|법원|관공서|시청|구청|우체국|학교|회사|보험사|병원|법원|경찰|소방|정부|행정|세금|국세청|건강보험|연금)/i.test(
        message,
      );

    const parts: string[] = [];
    if (hasFamily)
      parts.push(
        "메시지 전에 이미 저장·알고 있던 가족·지인 번호로 직접 통화하거나 만나서 확인",
      );
    if (hasOrg)
      parts.push(
        "해당 기관의 공식 웹사이트·앱·저장된 콜센터로 직접 접속·문의 (메시지에 나온 번호·링크 사용 금지)",
      );
    if (!hasFamily && !hasOrg)
      parts.push(
        "메시지 전에 이미 알고 있던 공식 연락처·가족·지인 경로로만 확인 (메시지에 포함된 연락처·URL·계좌는 쓰지 않음)",
      );

    fields["독립확인"] = parts.join(". ") + ".";
  }

  // 5. 답장예시
  if (!message) {
    fields["답장예시"] =
      "\"메시지가 아직 없어서 도와줄 수 없어. 의심되는 문자나 내용을 그대로 붙여넣어 주면, 혼자 판단하지 말고 이미 알던 경로로 확인할 방법을 정리해 줄게.\"";
  } else if (branch === "즉시중지") {
    fields["답장예시"] =
      "\"급하다는 말과 계좌(또는 링크·인증 요구)가 같이 있다. 바로 움직이지 않고, 이미 알고 있던 번호·공식 채널로 먼저 확인할게. 조금 기다려 줘.\"";
  } else if (branch === "먼저확인") {
    fields["답장예시"] =
      "\"번호(계좌·연락처)가 바뀌었다는 메시지가 왔다. 새로 온 내용만으로 바로 바꾸지 않고, 원래 알던 경로로 먼저 확인할게.\"";
  } else {
    fields["답장예시"] =
      "\"읽어 봤다. 메시지 하나로 바로 결론 내리지 않고, 필요한 부분은 이미 알던 경로로 확인해 볼게.\"";
  }

  // 6. 판단이유
  fields["판단이유"] = branchReason;

  // 7. 하지말것
  if (branch === "즉시중지") {
    fields["하지말것"] =
      "메시지 속 계좌로 입금·이체, 압박에 따른 즉단 송금, 메시지 하나로 결론 내리기, 링크 열기·앱 설치·원격접속·수락, 자격증명·인증번호 입력, 메시지 속 번호·계좌로 연락, 혼자 급박하게 행동하기.";
  } else if (branch === "먼저확인") {
    fields["하지말것"] =
      "메시지 속 새 번호·계좌·링크·채널로 바로 연락·변경, 메시지에 포함된 연락처·계좌·URL을 그대로 쓰기, \"바뀌었다\"는 말만 믿고 기존 경로를 끊기.";
  } else if (branch === "일반") {
    fields["하지말것"] =
      "메시지 하나로 바로 결론·행동 내리기, 확인하지 않고 압박에 따르기, 필요 이상으로 서둘러 대응하기.";
  } else {
    fields["하지말것"] =
      "메시지 없이 판단 내리기, 공란 상태에서 이 서비스를 \"판정기\"처럼 오해하기.";
  }

  // ---- 공공데이터 기반 참고 정보 (출처 표기 + 유형 태그 + 예방 팁) ----
  // 판정 어휘 없이, 멈추고 확인하는 절차를 돕는 참고 자료 성격으로 제공
  const publicDataInfo = buildPublicDataInfo(message, branch, hasCustomerTitle, hasFamily, hasOrg);

  return {
    fields,
    publicDataInfo,
    branch,
  };
}

/** Solar Pro 4 보강 (키 있을 때만)
 * 규칙 기반 7필드는 그대로 두고, 판단이유·안내 문장을 더 읽기 쉽게 보강하는 용도.
 * 판정 어휘(사기/진짜/가짜/안전 등)는 절대 추가하지 않음.
 * Upstage Chat completions API (POST /v1/chat/completions) 사용.
 * 모델명은 SOLAR_MODEL 환경변수 또는 기본값. 실제 모델 ID는 Upstage 대시보드 기준.
 */
async function buildSolarReasoning(
  apiKey: string,
  fields: Record<string, string>,
  branch: string,
  publicDataInfo: {
    fraudTypeTags: { tag: string; source: string }[];
    preventionTips: { tip: string; source: string }[];
    scenarioNote: string;
  },
): Promise<{ reasoning?: string; guidance?: string }> {
  const model = process.env.SOLAR_MODEL ?? "solar-pro4-260806";
  const prompt = `당신은 의심되는 메시지를 접한 사람에게 "멈추고 이미 알고 있던 경로로 확인하는 절차"를 안내하는 도우미입니다.
다음 정보는 규칙 기반으로 정리한 결과와 참고 정보입니다. 이 내용을 바탕으로,
- "판단이유"를 더 읽기 쉬운 한 단락으로 다듬고,
- "지금 이럴 때"(중단조치 기반) 안내 한 줄을 더 또렷하게 보강해 주세요.

규칙: 절대 "사기", "진짜", "가짜", "안전", "위험", "피싱", "스미싱", "보이스피싱" 같은 판정 어휘를 만들지 마세요.
숫자나 %로 가능성을 표현하지 마세요(확률·점수·백분율 금지).
112, 119, 1332, 1366, 1398, 1345 같은 긴급·기관 번호를 숫자로 넣지 마세요.
환불·복구·배상·보상 약속 문장을 만들지 마세요.

출력은 JSON만 반환하세요. 추가 설명 없음.
{"reasoning": "... 다듬은 판단이유 ...", "guidance": "... 또렷해진 지금 이럴 때 안내 한 줄 ..."}

현재 분기: ${branch}
규칙 기반 판단이유: ${fields["판단이유"]}
규칙 기반 중단조치: ${fields["중단조치"]}
규칙 기반 하지말것: ${fields["하지말것"]}
규칙 기반 독립확인: ${fields["독립확인"]}
공공데이터 참고 정보:
- 시나리오노트: ${publicDataInfo.scenarioNote}
- 사기유형태그: ${JSON.stringify(publicDataInfo.fraudTypeTags)}
- 예방팁: ${JSON.stringify(publicDataInfo.preventionTips)}
`;

  const res = await fetch("https://api.upstage.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4096,
      temperature: 0.3,
      reasoning_effort: "high",
    }),
  });

  if (!res.ok) {
    throw new Error(`Solar API 오류: ${res.status}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: string;
  };
  const text =
    data.choices?.[0]?.message?.content ?? data.error ?? "";
  try {
    const parsed = JSON.parse(text);
    return {
      reasoning:
        typeof parsed.reasoning === "string" && parsed.reasoning.trim()
          ? parsed.reasoning.trim()
          : undefined,
      guidance:
        typeof parsed.guidance === "string" && parsed.guidance.trim()
          ? parsed.guidance.trim()
          : undefined,
    };
  } catch {
    return {
      reasoning:
        text.includes("reasoning") || text.includes("판단이유") ? text : undefined,
    };
  }
}

/** 금지 패턴 검사 (P0 표시용) */
function prohibitedSummary(fields: Record<string, string>): string[] {
  const list = checkProhibitedOutput(fields);
  return list.length
    ? list
    : ["없음 — 출력이 금지 패턴 규칙을 위반하지 않습니다."];
}

/** 분기 표시용 라벨 */
function branchLabel(branch: string): string {
  return {
    즉시중지: "⚠ 즉시중지",
    먼저확인: "🔍 먼저확인",
    일반: "📄 일반",
    입력필요: "✏️ 입력필요",
  }[branch] ?? branch;
}

/** API 핸들러 */
export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.UPSTAGE_API_KEY ?? "";
    const body = await request.json();
    const rawMessage = body.message;
    const rawImage = body.image;

    // ---- OCR 처리 (이미지만, 또는 이미지 + 텍스트) ----
    let ocrExtractedText = "";
    let ocrLowConfidence = false;
    let ocrNote: string | null = null;
    let ocrFailure = false;

    if (rawImage && typeof rawImage === "object" && rawImage.data) {
      const imageData = rawImage.data;
      const mimeType = (rawImage.mimeType as string) ?? "image/png";

      if (!apiKey) {
        // OCR 키 없음 — 기존 텍스트-only 경로로 fallback
        ocrNote = "이미지 분석을 시도했지만, OCR API 키가 설정되지 않아 이미지에서 텍스트를 읽지 못했습니다. 텍스트를 직접 입력해 주세요.";
        ocrFailure = true;
      } else {
        try {
          const ocrResult = await extractTextFromImage(imageData, apiKey, mimeType);
          ocrExtractedText = ocrResult.text;
          // confidence 기준: 명시적으로 낮을 때만 플래그(기준은추후 조정)
          // Upstage confidence는 0~1 범위. 0.7 미만을 "낮음"으로 시작.
          if (ocrResult.confidence !== null && ocrResult.confidence < 0.7) {
            ocrLowConfidence = true;
          }
          if (!ocrExtractedText.trim()) {
            ocrNote = "이미지에서 텍스트를 충분히 읽지 못했습니다. 텍스트를 직접 입력해 주세요.";
            ocrFailure = true;
          }
        } catch (ocrErr) {
          const msg =
            ocrErr instanceof Error ? ocrErr.message : "이미지 분석 중 오류";
          ocrNote = `이미지 분석 중 오류가 발생했습니다: ${msg}. 텍스트를 직접 입력해 주세요.`;
          ocrFailure = true;
        }
      }
    }

    // ---- 분석 대상 텍스트 ----
    // OCR 추출 텍스트가 있고 원문 메시지가 없으면 OCR 텍스트만 사용
    // 둘 다 있으면 결합 (메시지가 주, OCR이 보조)
    let analyzeText: string;
    if (ocrExtractedText && !rawMessage) {
      analyzeText = ocrExtractedText;
    } else if (ocrExtractedText && rawMessage) {
      analyzeText = rawMessage + "\n\n[이미지 추출 텍스트]\n" + ocrExtractedText;
    } else {
      analyzeText = rawMessage ?? "";
    }

    if (ocrFailure) {
      // OCR 실패지만 원문 메시지가 있으면 원문만으로 계속 분석
      if (rawMessage && typeof rawMessage === "string" && rawMessage.trim().length > 0) {
        // 원문만으로 분석 계속 (ocrNote는 결과에 포함)
      } else {
        return NextResponse.json(
          {
            error: "분석할 내용이 필요합니다. 텍스트를 입력하거나, OCR 가능한 선명한 이미지를 올려 주세요.",
            status: "입력필요",
          },
          { status: 400 },
        );
      }
    }

    if (typeof analyzeText !== "string" || analyzeText.trim().length === 0) {
      return NextResponse.json(
        {
          error: "메시지가 필요합니다. 최소 한 줄 이상 입력해 주세요.",
          status: "입력필요",
        },
        { status: 400 },
      );
    }

    const { fields, publicDataInfo, branch } = buildFields(analyzeText);

    // ---- Solar Pro 4 보강 (키 있을 때만, 실패해도 기존 결과 유지) ----
    let solarReasoning: string | undefined;
    let solarGuidance: string | undefined;
    if (apiKey) {
      try {
        const solar = await buildSolarReasoning(
          apiKey,
          fields,
          branch,
          publicDataInfo,
        );
        solarReasoning = solar.reasoning;
        solarGuidance = solar.guidance;
      } catch {
        // Solar 보강 실패 시 규칙 기반 결과 그대로 사용
      }
    }

    // 금지 패턴 검사 결과 (fields만 검사 — publicDataInfo는 제외)
    const prohibited = checkProhibitedOutput(fields);

    // ---- OCR 신뢰도/추출 텍스트 응답 반영 ----
    const responseBody: Record<string, unknown> = {
      status: fields["상태"],
      branch,
      branchLabel: branchLabel(branch),
      fields,
      publicDataInfo,
      prohibited,
      timestamp: new Date().toISOString(),
      notice:
        "이 결과는 메시지 진위를 판정하지 않습니다. 공공데이터를 참고한 독립 확인 절차를 정리한 것입니다. 제공을 식별하지 않고 범주로만 표현했습니다.",
    };

    if (solarReasoning) {
      responseBody.solarReasoning = solarReasoning;
    }
    if (solarGuidance) {
      responseBody.solarGuidance = solarGuidance;
    }

    if (ocrLowConfidence) {
      responseBody.ocrLowConfidence = true;
      responseBody.ocrExtractedText = ocrExtractedText;
      responseBody.ocrNote = "이미지 속 글자가 덜 읽혔을 수 있어요. 아래 읽은 텍스트를 확인하고 필요하면 직접 고쳐 주세요.";
    } else if (ocrExtractedText && !ocrFailure) {
      responseBody.ocrExtractedText = ocrExtractedText;
      responseBody.ocrNote = "이미지에서 읽은 텍스트를 분석에 반영했습니다.";
    }
    if (ocrNote && !ocrLowConfidence) {
      responseBody.ocrNote = ocrNote;
    }

    return NextResponse.json(responseBody, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      {
        error: "분석 중 오류가 발생했습니다. 다시 시도해 주세요.",
        status: "검증전",
      },
      { status: 500 },
    );
  }
}

/** 헬스체크용 GET (배포 확인용) */
export async function GET() {
  return NextResponse.json({
    service: "두번째문 (second-door) 분석 API",
    version: "0.2.0",
    note: "POST /api/analyze 에 { message: '...' } 로 요청. 공공데이터 출처·유형태그·예방팁 포함.",
  });
}
