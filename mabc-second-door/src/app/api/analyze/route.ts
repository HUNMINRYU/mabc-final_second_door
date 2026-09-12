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
    /(https?:\/\/[^\s<>"]+|www\.[^\s<>"]+)/gi,
    "[링크]",
  );

  // 계정·전화번호 유사 pattern (010-0000-0000, 02-000-0000 등)
  s = s.replace(/\b01[0-9]-\d{3,4}-\d{4}\b/g, "[메시지 속 번호]");
  s = s.replace(/\b0[2-9]?-\d{3,4}-\d{4}\b/g, "[메시지 속 번호]");

  // Toss 라벨 + 연속된 숫자 (계좌번호 유사)
  s = s.replace(
    /\b(Toss|토스|toss)\s*[\-·\s]?\d[\d\-\s]*\d\b/gi,
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
  if (/\b고객님|고객\s*님\b/i.test(text)) {
    s = s.replace(
      /\b(고객님|고객\s*님)\b/gi,
      "[발신자 표시]",
    );
  }

  return s;
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

  // 복구·환불·배상·보장 약속
  if (
    /\b(환불|복구|배상|보상|되돌림|원상|보장[합니다]?|예정[입니다]?)\b/i.test(allText)
  ) {
    prohibited.push("복구/환불/배상/보장 약속");
  }

  return prohibited;
}

/** 7개 필드 생성 */
function buildFields(raw: string): Record<string, string> {
  const message = raw.trim();
  const sanitized = sanitizeIdentifiers(message);

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
      /\b(이체|송금|입금|보내(어|주세요|줘|줄래)|계좌|통장|은행|금융|정산|수금|납부|결제)\b/i.test(
        message,
      ) && /\b(돈|금액|급[합니다]?|당장|지금|바로|오늘|어제|병원비|빌려|대출|상환|외상)\b/i.test(
        message,
      );

    const hasCredential =
      /\b(비밀번호|인증번호|보안카드|OTP|일회용|인증[번호코드]|계정|아이디|로그인|확인[번호코드]|본인[인증확인])\b/i.test(
        message,
      );

    const hasLinkInstall =
      /(https?:\/\/|www\.)/i.test(message) &&
      /\b(입력|설치|다운로드|실행|열어|클릭|접속|확인[하세요하]|로그|인증|보호[앱프로그램]|업데이트|백신|보안[프로그램앱])\b/i.test(
        message,
      );

    const hasRemote =
      /\b(원격|원격제어|팀뷰어|AnyDesk|애니데스크|화면공유|접속|제어|조종|접속|연결|해킹|보기|관찰|감시)\b/i.test(
        message,
      );

    const hasSecretPressure =
      /\b(비밀|함부로|절대|누구에게도|말하지|밖에|다른사람|알려지면|혼자|조용히|급[합니다]?|지금 당장|바로|빨리|늦으면|기회|마지막|오늘 안|지금만|긴급|중요[합니다]?|사망|사고|입원|구속|체포|경찰|법원|소송|출석|출석요구|수사|조사)\b/i.test(
        message,
      );

    const hasActionDone =
      /\b(이미|벌써|방금|아까|전에|완료|끝났[습니다]?|보냈[습니다]?|입금[했습니했]?(어요|다)|보냈어요|(송금|이체|인증)[했습니했]?)\b/i.test(
        message,
      );

    if (
      hasTransfer ||
      hasCredential ||
      hasLinkInstall ||
      hasRemote ||
      hasSecretPressure ||
      hasActionDone
    ) {
      branch = "즉시중지";
      const reasons: string[] = [];
      if (hasTransfer) reasons.push("이체/송금 관련 요청");
      if (hasCredential) reasons.push("자격증명·인증 정보 요구");
      if (hasLinkInstall) reasons.push("링크·설치 요구");
      if (hasRemote) reasons.push("원격접속·제어 요구");
      if (hasSecretPressure) reasons.push("비밀·급한 압박");
      if (hasActionDone) reasons.push("이미 행동이 있었을 가능성");
      branchReason = reasons.join("·") + "이(가) 있어 검증 전 상태로 둡니다.";
    } else if (
      // 먼저확인: 번호·계좌·연락처·채널을 바꾸지만 즉시중지 신호는 없음
      /\b(바꿨[어다]|바뀌[었었]어|번호|연락처|전화|카톡|문자|이메일|주소|채널|계좌|새[번호전화]|이[번호번]|앞[으로]로|이제[부터는부터는]|연락[해다오세요])\b/i.test(
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
    if (/\b(급[합니다]?|당장|지금|바로|오늘|병원비|입원|사고|사망|응급|수술|치료|약|빚|대출|상환|외상|돈|금액)\b/i.test(message))
      claimCandidates.push("\"급함·금전 요구\" 주장");
    if (/\b(아들|딸|엄마|아빠|부모|자녀|조카|친구|동료|선배|후배|가족|형|누나|오빠|언니|남동생|여동생|친척|지인)\b/i.test(message))
      claimCandidates.push("\"관계·발신자\" 주장");
    if (/\b(계좌|은행|입금|송금|이체|통장|금융|정산|수금|납부|결제|카드|현금)\b/i.test(message))
      claimCandidates.push("\"계좌·이체\" 주장");
    if (/\b(비밀번호|인증번호|보안|인증|확인[번호코드]|본인[인증확인]|로그인|계정|아이디|OTP)\b/i.test(message))
      claimCandidates.push("\"자격증명·인증\" 요구");
    if (/\b(https?:\/\/|www\.|링크|주소|url|클릭|열어|접속|방문)\b/i.test(message))
      claimCandidates.push("\"링크·접속\" 요구");
    if (/\b(설치|다운로드|실행|앱|프로그램|업데이트|백신|보안[프로그램앱]|보호[앱프로그램])\b/i.test(message))
      claimCandidates.push("\"설치·소프트웨어\" 요구");
    if (/\b(원격|화면|제어|접속|연결|팀뷰어|AnyDesk|애니데스크|공유|보기|관찰|감시|해킹)\b/i.test(message))
      claimCandidates.push("\"원격접속·제어\" 요구");
    if (/\b(바꿨[어다]|바뀌[었었]어|번호|연락처|전화|카톡|문자|이메일|주소|채널|새[번호전화]|이[번호번]|앞[으로]로)\b/i.test(message))
      claimCandidates.push("\"연락처·채널 변경\" 주장");

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
      /\b(아들|딸|엄마|아빠|부모|자녀|가족|형|누나|오빠|언니|남동생|여동생|친척|조카)\b/i.test(
        message,
      );
    const hasOrg =
      /\b(은행|카드사|통신사|택배|경찰서|법원|관공서|시청|구청|우체국|학교|회사|보험사|병원|법원|경찰|소방|정부|행정|세금|국세청|건강보험|연금)\b/i.test(
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

  return fields;
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
    const body = await request.json();
    const rawMessage = body.message;

    if (typeof rawMessage !== "string" || rawMessage.trim().length === 0) {
      return NextResponse.json(
        {
          error: "메시지가 필요합니다. 최소 한 줄 이상 입력해 주세요.",
          status: "입력필요",
        },
        { status: 400 },
      );
    }

    const fields = buildFields(rawMessage);
    const branch = fields["판단이유"].startsWith("메시지가 비어")
      ? "입력필요"
      : // 재계산 없이 재도출: buildFields가 이미 분기 결정
        // 여기선 판단이유 앞부분을 보고 분기 재추출 (단순화)
        (() => {
          const reason = fields["판단이유"];
          if (reason.includes("입력필요") || reason.startsWith("메시지가 비어"))
            return "입력필요";
          if (reason.includes("즉시중지")) return "즉시중지";
          if (reason.includes("먼저확인")) return "먼저확인";
          return "일반";
        })();

    // 금지 패턴 검사 결과
    const prohibited = checkProhibitedOutput(fields);

    // ---- 주의: 원본 식별자는 절대 클라이언트에 그대로 보내지 않음 ----
    // 이미 buildFields에서 sanitizeIdentifiers로 치환했으므로 fields 안에는
    // [메시지 속 계좌]/[메시지 속 번호]/[링크]/[코드] 범주만 남아 있음.

    return NextResponse.json({
      status: fields["상태"],
      branch,
      branchLabel: branchLabel(branch),
      fields,
      prohibited,
      timestamp: new Date().toISOString(),
      notice:
        "이 결과는 메시지 진위를 판정하지 않습니다. 독립 확인 절차를 정리한 것입니다. 제공을 식별하지 않고 범주로만 표현했습니다.",
    });
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
    version: "0.1.0",
    note: "POST /api/analyze 에 { message: '...' } 로 요청",
  });
}
