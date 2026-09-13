"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// 두번째문(second-door) — 의심 메시지 분석 서비스
// 규칙 기반 7필드 출력 (키 없이 동작, Solar 호출은 선택 사항)
// Solar Pro 4 연동: NEXT_PUBLIC_UPSTAGE_API_KEY 환경변수가 있으면
// 판단이유 문장을 Solar로 보강할 수 있음 (키 없으면 규칙 기반으로만 동작)

type AnalyzeResult = {
  status: string;
  branch: string;
  branchLabel: string;
  fields: {
    [key: string]: string;
  };
  publicDataInfo: {
    dataSources: { name: string; url: string; source: string }[];
    fraudTypeTags: { tag: string; source: string }[];
    preventionTips: { tip: string; source: string }[];
    scenarioNote: string;
  };
  prohibited: string[];
  notice: string;
  timestamp: string;
};

type ToastVariant = "loading" | "success" | "error" | "info";

interface ToastData {
  id: number;
  variant: ToastVariant;
  title: string;
  message: string;
}

const EXAMPLE_PRESETS: { label: string; message: string; hint: string }[] = [
  {
    label: "아들 사칭 급전 메시지",
    message:
      "엄마 나 아들인데 갑자기 급전이 필요해서 그래. 지금 바로 80만원만 계좌번호 3333-12-345678로 보내줄 수 있어? 빨리 해줘. 나 지금 밖에 나와있어서 연락 급해.",
    hint: "즉시중지 신호 예시",
  },
  {
    label: "새 연락처로 바꾸라는 메시지",
    message:
      "안녕하세요. 저희 팀 단체 카톡방 번호가 바뀌었습니다. 이제부터 새 번호 010-9999-8888로 연락 주세요. 기존 번호는 이제 안 씁니다. 변경 사항 확인하시고 새 번호로 바로 연락 부탁드립니다.",
    hint: "먼저확인 신호 예시",
  },
  {
    label: "이미 보냈으니 확인하라는 압박 메시지",
    message:
      "아까 계좌로 50만원 이미 보냈는데 왜 아직 입금이 안 됐냐고 따지네요. 지금 바로 확인해야 한다고 하시고, 안 그러면 문제가 생긴대요. 안 보내면 신고하겠다고 하시는 상황입니다.",
    hint: "이미 행동이 있었을 가능성 예시",
  },
  {
    label: "읽어볼 만한 의심 메시지 (일반)",
    message:
      "안녕하세요. 이번에 행사 준비를 맡고 있는 ○○팀 담당자입니다. 내일 회의 관련해서 조율이 필요한 내용이 있어서 연락드립니다. 자세한 내용은 링크로 공유드릴게요. 확인해 보시고 의견 주시면 준비하겠습니다.",
    hint: "일반적인 의심 메시지",
  },
];

const CONTEXT_NOTE =
  "최근 통신·금융 사칭 메시지는 가족·지인 관계를 내세우거나 새 연락처·계좌 변경을 요구하는 형태가 중심입니다. 이 서비스는 개별 메시지의 진위를 판정하지 않으며, 멈추고 이미 알고 있던 경로로 확인하는 절차만 정리합니다.";

export default function Home() {
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<ToastData | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // 토스트 헬퍼 — 새 토스트가 오면 이전 토스트는 제거됨(단일 토스트)
  const addToast = useCallback(
    (variant: ToastVariant, title: string, message: string) => {
      setToast({ id: Date.now(), variant, title, message });
    },
    [],
  );

  const clearToast = useCallback(() => {
    setToast(null);
  }, []);

  const selectPreset = (preset: (typeof EXAMPLE_PRESETS)[number]) => {
    setMessage(preset.message);
    setResult(null);
    setError("");
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const resetAll = useCallback(() => {
    setMessage("");
    setResult(null);
    setError("");
    setLoading(false);
    clearToast();
    document.body.classList.remove("body-scroll-locked");
    textareaRef.current?.focus();
  }, [clearToast]);

  const handleAnalyze = async () => {
    if (!message.trim()) {
      setError("분석할 메시지를 입력해 주세요. 최소 한 줄 이상이어야 합니다.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    addToast("loading", "분석 중", "메시지를 분석하고 있습니다…");

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "분석 중 오류가 발생했습니다.");
      }

      const data = await res.json();

      // 식별자 노출 확인 (로깅 전용)
      const fieldsText = Object.values(data.fields)
        .join(" ")
        .toLowerCase();
      if (fieldsText.includes("3333-12-345678") || fieldsText.includes("010-9999-8888")) {
        console.error("주의: 응답 필드에 원본 식별자가 포함되어 있습니다.");
      }

      // 약간의 지연 후 결과 표시 (자연스러운 피드백 느낌을 위해)
      addToast("success", "분석 완료", "결과를 확인하려면 아래 카드를 참고하세요.");
      await new Promise((resolve) => setTimeout(resolve, 900));
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.");
      addToast(
        "error",
        "분석 오류",
        e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleAnalyze();
  };

  const closeResult = useCallback(() => {
    setResult(null);
    clearToast();
    document.body.classList.remove("body-scroll-locked");
  }, [clearToast]);

  // 결과 모달 열릴 때: 본문 스크롤 잠금 + 닫기 버튼 포커스
  // 결과 모달 닫힐 때: 본문 스크롤 복원 + 이전 요소로 포커스 복귀
  useEffect(() => {
    if (result) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      document.body.classList.add("body-scroll-locked");
      const timer = setTimeout(() => {
        const closeBtn = document.querySelector(".result-close-button") as HTMLElement | null;
        if (closeBtn) {
          closeBtn.focus();
        }
      }, 150);
      return () => {
        clearTimeout(timer);
        document.body.classList.remove("body-scroll-locked");
      };
    } else {
      document.body.classList.remove("body-scroll-locked");
    }
  }, [result]);

  // Escape 키로 결과 모달 닫기
  useEffect(() => {
    if (!result) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeResult();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [result, closeResult]);

  const prohibitedSummary =
    result &&
    (result.prohibited.length > 0 &&
      result.prohibited[0] !== "없음 — 출력이 금지 패턴 규칙을 위반하지 않습니다.");

  const resultHeadClass = `result-head result-head--${
    result?.branch === "즉시중지"
      ? "error"
      : result?.branch === "먼저확인"
        ? "warning"
        : result?.branch === "입력필요"
          ? "muted"
          : "success"
  }`;
  const prohibitedBoxClass = `prohibited-box prohibited-box--${
    prohibitedSummary ? "error" : "success"
  }`;

  return (
    <main className="container">
      <a href="#main-content" className="skip-link">
        본문으로 이동
      </a>

      {/* 토스트 알림 (화면 상단, 단일 토스트) */}
      {toast && (
        <div
          className={`toast toast--${toast.variant}`}
          role="alert"
          aria-live="polite"
        >
          <div className="toast-title">{toast.title}</div>
          <div className="toast-message">{toast.message}</div>
        </div>
      )}

      {/* 헤더 */}
      <header className="page-header">
        <h1 className="title">두번째문</h1>
        <p className="subtitle">
          의심 메시지를 붙여넣으면, 판단 대신{" "}
          <strong className="strong-inherit">멈추고 확인하는 절차</strong>를
          정리해 드립니다.
        </p>
        <div className="pill-group">
          <span>의심 메시지를 붙여넣으면</span>
          <span className="pill-dot">·</span>
          <span>멈추고 확인하는 절차를 안내합니다</span>
        </div>
      </header>

      {/* 입력 폼 */}
      <section className="card input-card" id="main-content">
        <form onSubmit={handleSubmit}>
          <div className="field-label-row">
            <label htmlFor="message" className="field-label">
              의심되는 메시지
            </label>
          </div>
          <textarea
            id="message"
            name="message"
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="예: 아들 사칭 급전, 새 연락처 변경, 회의 안내 메시지 등 — 의심 내용을 그대로 붙여넣어 주세요. 최소 한 줄 이상…"
            rows={6}
            className="message-input"
            aria-describedby="message-hint"
            autoComplete="off"
          />
          <span id="message-hint" className="text-tiny">
            최소 한 줄 이상의 의심 메시지 원문을 넣어 주세요.
          </span>

          <div className="chip-row">
            <div className="chip-group">
              {EXAMPLE_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => selectPreset(p)}
                  className="chip"
                >
                  {p.label}
                </button>
              ))}
            </div>
            <span className="hint-text">
              {EXAMPLE_PRESETS.map((p) => p.hint).join(" · ")}
            </span>
          </div>

          <div className="action-row">
            <button
              type="submit"
              disabled={loading || !message.trim()}
              className="analyze-button"
            >
              {loading && <span className="spinner" aria-hidden="true" />}
              {loading ? "분석 중…" : "분석하기"}
            </button>
            {error && (
              <p id="analyze-error" className="alert alert--error" role="alert">
                {error}
              </p>
            )}
            {result && (
              <button
                type="button"
                onClick={resetAll}
                className="reset-button"
              >
                다시 분석하기
              </button>
            )}
          </div>
        </form>
      </section>

      {/* 결과 팝업 오버레이 (중앙 카드 + 백드롭) */}
      {result && (
        <div
          className="result-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="result-title"
        >
          <div
            className="result-backdrop"
            onClick={closeResult}
            aria-hidden="true"
          />
          <div className="result-modal">
            <div className="result-modal-header">
              <div className={resultHeadClass}>
                <div className="result-head-row">
                  <span
                    className={`result-head-badge result-head-badge--${
                      result?.branch === "즉시중지"
                        ? "error"
                        : result?.branch === "먼저확인"
                          ? "warning"
                          : result?.branch === "입력필요"
                            ? "muted"
                            : "success"
                    }`}
                  >
                    {result.branchLabel}
                  </span>
                  <span className="result-meta">{result.status}</span>
                </div>
                <span className="result-timestamp">
                  {new Date(result.timestamp).toLocaleString("ko-KR")}
                </span>
              </div>
              <button
                type="button"
                className="result-close-button"
                onClick={closeResult}
                aria-label="분석 결과 닫기"
              >
                ✕
              </button>
            </div>
            <div className="result-modal-body">
              <h2 id="result-title" className="result-modal-title">
                분석 결과
              </h2>
              <div className="field-list">
                <dl className="result-fields-dl">
                  {([
                    ["상태", "status"],
                    ["중단조치", "중단조치"],
                    ["확인할주장", "확인할주장"],
                    ["독립확인", "독립확인"],
                    ["답장예시", "답장예시"],
                    ["판단이유", "판단이유"],
                    ["하지말것", "하지말것"],
                  ] as const).map(([labelKey, fieldKey]) => (
                    <div key={fieldKey} className="field-row">
                      <dt className="field-label">{labelKey}</dt>
                      <dd className="field-value">{result.fields[fieldKey]}</dd>
                    </div>
                  ))}
                </dl>

                {/* 공공데이터 참고 정보 (출처 + 유형 태그 + 예방 팁 + 시나리오 노트) */}
                {result.publicDataInfo && (
                  <div className="public-data-section">
                    <h3 className="public-data-title">📚 참고 정보</h3>

                    {/* 시나리오 노트 */}
                    <div className="public-data-card">
                      <p className="public-data-label">시나리오 노트</p>
                      <p className="public-data-text">
                        {result.publicDataInfo.scenarioNote}
                      </p>
                    </div>

                    {/* 사기 유형 태그 */}
                    {result.publicDataInfo.fraudTypeTags.length > 0 && (
                      <div className="public-data-card">
                        <p className="public-data-label">관련 유형 태그</p>
                        <ul className="tag-list">
                          {result.publicDataInfo.fraudTypeTags.map((t) => (
                            <li key={t.tag} className="tag-item">
                              <span className="tag-name">{t.tag}</span>
                              <span className="tag-source">
                                {t.source === "official" ? "공식 분류" : "종합 분류"}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* 예방 팁 */}
                    {result.publicDataInfo.preventionTips.length > 0 && (
                      <div className="public-data-card">
                        <p className="public-data-label">예방 참고</p>
                        <ul className="tip-list">
                          {result.publicDataInfo.preventionTips.map((t, i) => (
                            <li key={i} className="tip-item">
                              <span className="tip-text">{t.tip}</span>
                              <span className="tip-source">
                                {t.source === "official" ? "공식 안내" : "종합 안내"}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* 사용 출처 */}
                    <div className="public-data-card public-data-sources">
                      <p className="public-data-label">사용한 공공데이터 출처</p>
                      <ul className="source-list">
                        {result.publicDataInfo.dataSources.map((s, i) => (
                          <li key={i} className="source-item">
                            <a
                              href={s.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="source-link"
                            >
                              {s.name}
                            </a>
                            <span className="source-type">
                              {s.source === "official" ? "공식" : "종합"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* 금지 패턴 표시 */}
                <div className={prohibitedBoxClass}>
                  <p
                    className={`prohibited-box-title prohibited-box-title--${
                      prohibitedSummary ? "error" : "success"
                    }`}
                  >
                    {prohibitedSummary ? "⚠ 금지 패턴 검사" : "✅ 금지 패턴 검사"}
                  </p>
                  <p
                    className={`prohibited-box-text prohibited-box-text--${
                      prohibitedSummary ? "error" : "success"
                    }`}
                  >
                    {result.prohibited.join(" · ")}
                  </p>
                </div>
              </div>

              {/* 안내문 */}
              <p className="result-notice">{result.notice}</p>
            </div>
          </div>
        </div>
      )}

      {/* 어떻게 쓰면 되나요? */}
      {!result && (
        <section className="card howto-section">
          <h2 className="howto-title">어떻게 쓰면 되나요?</h2>
          <ul className="howto-list">
            <li>
              의심되는 문자·카톡·이메일 내용을{" "}
              <strong>그대로</strong> 붙여넣으세요.
            </li>
            <li>
              분석 버튼만 누르면 됩니다. 별도 가입·로그인·키 입력이 없습니다.
            </li>
            <li>
              결과는 메시지 진위를 판정하지 않습니다. 대신{" "}
              <strong>멈추고, 이미 알던 경로로 확인하는</strong>{" "}
              절차를 정리해 드립니다.
            </li>
          </ul>
          <p className="howto-note">{CONTEXT_NOTE}</p>
        </section>
      )}

      {/* 푸터 */}
      <footer className="footer">
        두번째문 (second-door) — 의심 메시지를 붙여넣으면 멈추고 확인하는 절차를
        안내합니다
      </footer>
    </main>
  );
}
