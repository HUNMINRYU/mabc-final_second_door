"use client";

import { useState, useRef } from "react";

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
  prohibited: string[];
  notice: string;
  timestamp: string;
};

const EXAMPLE_PRESETS = [
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectPreset = (preset: (typeof EXAMPLE_PRESETS)[number]) => {
    setMessage(preset.message);
    setResult(null);
    setError("");
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleAnalyze = async () => {
    if (!message.trim()) {
      setError("분석할 메시지를 입력해 주세요. 최소 한 줄 이상이어야 합니다.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

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

      const fieldsText = Object.values(data.fields)
        .join(" ")
        .toLowerCase();
      if (fieldsText.includes("3333-12-345678") || fieldsText.includes("010-9999-8888")) {
        console.error("주의: 응답 필드에 원본 식별자가 포함되어 있습니다.");
      }

      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleAnalyze();
  };

  const prohibitedSummary =
    result &&
    (result.prohibited.length > 0 &&
      result.prohibited[0] !== "없음 — 출력이 금지 패턴 규칙을 위반하지 않습니다.");

  return (
    <main className="container">
      {/* 헤더 */}
      <header style={{ textAlign: "center", marginBottom: "2.5rem" }}>
        <h1 className="title">두번째문</h1>
        <p className="subtitle">
          의심 메시지를 붙여넣으면, 판단 대신{" "}
          <strong style={{ color: "inherit" }}>멈추고 확인하는 절차</strong>를
          정리해 드립니다.
        </p>
        <div className="pill-group">
          <span>키 없이 동작</span>
          <span className="pill-dot">·</span>
          <span>예선 당선 스킬 기반</span>
          <span className="pill-dot">·</span>
          <span>메시지 진위 판정 안 함</span>
        </div>
      </header>

      {/* 입력 폼 */}
      <section className="card input-card">
        <form onSubmit={handleSubmit}>
          <div className="field-label-row">
            <label htmlFor="message" className="field-label">
              의심되는 메시지
            </label>
          </div>
          <textarea
            id="message"
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="의심스러운 문자, 카톡, 이메일, 메시지 내용을 그대로 붙여넣어 주세요. 최소 한 줄 이상."
            rows={6}
            className="message-input"
          />

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
              <p className="alert alert--error">{error}</p>
            )}
          </div>
        </form>
      </section>

      {/* 결과 */}
      {result && (
        <section
          className="card"
          style={{
            overflow: "hidden",
            marginBottom: "1.75rem",
          }}
        >
          {/* 결과 헤더 (분기 뱃지) */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "1rem 1.5rem",
              background:
                result.branch === "즉시중지"
                  ? "var(--error-surface)"
                  : result.branch === "먼저확인"
                  ? "var(--warning-surface)"
                  : result.branch === "입력필요"
                  ? "var(--muted-foreground)"
                  : "var(--success-surface)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span
                className="badge"
                style={{
                  background:
                    result.branch === "즉시중지"
                      ? "var(--error-surface)"
                      : result.branch === "먼저확인"
                      ? "var(--warning-surface)"
                      : result.branch === "입력필요"
                      ? "var(--muted-foreground)"
                      : "var(--success-surface)",
                  color:
                    result.branch === "즉시중지"
                      ? "var(--error-foreground)"
                      : result.branch === "먼저확인"
                      ? "var(--warning-foreground)"
                      : result.branch === "입력필요"
                      ? "var(--card-foreground)"
                      : "var(--success-foreground)",
                  border: "1px solid",
                  borderColor:
                    result.branch === "즉시중지"
                      ? "var(--error-border)"
                      : result.branch === "먼저확인"
                      ? "var(--warning-border)"
                      : result.branch === "입력필요"
                      ? "var(--muted-foreground)"
                      : "var(--success-border)",
                }}
              >
                {result.branchLabel}
              </span>
              <span style={{ color: "var(--muted-foreground)", fontSize: "0.85rem" }}>
                {result.status}
              </span>
            </div>
            <span style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>
              {new Date(result.timestamp).toLocaleString("ko-KR")}
            </span>
          </div>

          {/* 7개 필드 */}
          <div style={{ padding: "1.5rem" }}>
            <dl style={{ display: "grid", gap: "1rem" }}>
              {([
                ["상태", "status"],
                ["중단조치", "중단조치"],
                ["확인할주장", "확인할주장"],
                ["독립확인", "독립확인"],
                ["답장예시", "답장예시"],
                ["판단이유", "판단이유"],
                ["하지말것", "하지말것"],
              ] as const).map(([labelKey, fieldKey]) => (
                <div
                  key={fieldKey}
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <dt className="field-label">{labelKey}</dt>
                  <dd className="field-value">{result.fields[fieldKey]}</dd>
                </div>
              ))}
            </dl>

            {/* 금지 패턴 표시 */}
            <div
              className="alert"
              style={{
                marginTop: "1.25rem",
                padding: "0.85rem 1rem",
                borderRadius: "var(--radius)",
                background: prohibitedSummary
                  ? "var(--error-surface)"
                  : "var(--success-surface)",
                border: "1px solid",
                borderColor: prohibitedSummary
                  ? "var(--error-border)"
                  : "var(--success-border)",
              }}
            >
              <p
                style={{
                  margin: "0 0 0.25rem",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  color: prohibitedSummary
                    ? "var(--error-foreground)"
                    : "var(--success-foreground)",
                }}
              >
                {prohibitedSummary ? "⚠ 금지 패턴 검사" : "✅ 금지 패턴 검사"}
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.9rem",
                  color: prohibitedSummary
                    ? "var(--error-foreground)"
                    : "var(--success-foreground)",
                }}
              >
                {result.prohibited.join(" · ")}
              </p>
            </div>
          </div>

          {/* 안내문 */}
          <div
            style={{
              padding: "0.85rem 1.5rem",
              background: "var(--muted-foreground)",
              borderTop: "1px solid var(--border)",
              fontSize: "0.85rem",
              color: "var(--muted-foreground)",
              lineHeight: 1.5,
            }}
          >
            {result.notice}
          </div>
        </section>
      )}

      {/* 어떻게 쓰면 되나요? */}
      {!result && (
        <section className="card" style={{ padding: "1.5rem", marginBottom: "1.75rem" }}>
          <h2 style={{ margin: "0 0 0.75rem" }}>어떻게 쓰면 되나요?</h2>
          <ul
            style={{
              margin: "0 0 0.5rem",
              padding: "0 0 0 1.2rem",
              lineHeight: 1.7,
              color: "var(--foreground)",
            }}
          >
            <li>
              의심되는 문자·카톡·이메일 내용을{" "}
              <strong style={{ color: "inherit" }}>그대로</strong> 붙여넣으세요.
            </li>
            <li>
              분석 버튼만 누르면 됩니다. 별도 가입·로그인·키 입력이 없습니다.
            </li>
            <li>
              결과는 메시지 진위를 판정하지 않습니다. 대신{" "}
              <strong style={{ color: "inherit" }}>멈추고, 이미 알던 경로로 확인하는</strong>{" "}
              절차를 정리해 드립니다.
            </li>
          </ul>
          <p
            style={{
              marginTop: "1rem",
              color: "var(--muted-foreground)",
              fontSize: "0.9rem",
              lineHeight: 1.6,
            }}
          >
            {CONTEXT_NOTE}
          </p>
        </section>
      )}

      {/* 푸터 */}
      <footer className="footer">
        두번째문 (second-door) — 규칙 기반 분석 서비스 · 예선 당선 스킬 기반
        {typeof process !== "undefined" &&
        process.env.NEXT_PUBLIC_UPSTAGE_API_KEY ? (
          <> · Solar Pro 4 연동</>
        ) : (
          <> · Solar Pro 4 호출 없이 동작</>
        )}
      </footer>
    </main>
  );
}
