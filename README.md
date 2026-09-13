# 두번째문 — 의심 메시지 분석·확인 절차 서비스

> MABC 2026 결선 제출용 서비스 MVP
>
> 규칙 기반 Analyzer 서비스. Solar Pro 4 API 키 없이 동작하며, **메시지 진위를 판정하지 않고 멈추고 확인하는 절차를 7개 필드로 정리**해 준다.

---

## 한 줄 정의

의심스러운 메시지를 받은 사람이, 판단 대신 **멈추고 독립 확인할 절차를 7개 필드(상태·중단조치·확인할주장·독립확인·답장예시·판단이유·하지말것)로 정리**해 보여주는 공개 웹 서비스.

## 무엇을 하는 서비스인가

- 의심스러운 문자·카톡·이메일·메시지 내용을 텍스트로 붙여넣으면, 진위 판정 없이 **멈추고(이체·응답·링크·설치·원격접속을 하지 말고), 이미 알고 있던 경로로 확인하는 절차**를 정리한다.
- 결과는 `검증전` 상태로 고정되며, 메시지 진위를 판정하지 않는다.
- 예선 당선 스킬(**second-door / 두번째문**)의 규칙·출력 계약을 그대로 서비스 핵심 로직으로 이식했다.

## 제출물

- **서비스 MVP 공개 URL (Vercel)**: [https://mabc-second-door.vercel.app](https://mabc-second-door.vercel.app)
- **소스코드 저장소 (GitHub)**: [https://github.com/HUNMINRYU/mabc-second-door](https://github.com/HUNMINRYU/mabc-second-door)
- **PRD (미니 제품 요구사항 문서)**: `submissions/docs/prd.md` (이 저장소 내부)
- **발표 자료**: `submissions/presentation/presentation.html`
- **예선 당선 스킬 원본**: `submissions/skill/second-door.zip`

## 핵심 기능 (데모에서 보여줄 것)

1. **메시지 입력 → 7개 필드 출력**: 텍스트 영역에 메시지를 붙여넣고 분석 버튼을 누르면 7개 필드가 순서대로 표시된다.
2. **분기 표시 + 판단이유**: 내부 분기(`즉시중지 > 먼저확인 > 일반 > 입력필요`)를 상단 뱃지로 보여주고, 판단 근거로 `판단이유`를 표시한다.
3. **금지 패턴 검사 결과 표시**: 출력에 사기·진짜·가짜·안전 판정, 점수/확률/%, 제공된 식별자 반복, 긴급번호 숫자, 복구·환불 보장, 적극적 금지 행동(자격증명 입력·링크 열기·이체·설치·원격접속) 등이 포함되지 않도록 검사하고 결과를 표시한다.
4. **예시 프리셋 데모**: 버튼 하나로 예시 메시지를 넣고 바로 분석 결과를 시연할 수 있다.
   - 아들 급전(계좌 요구) → 즉시중지
   - 새 연락처로 바꾸라는 메시지 → 먼저확인
   - 이미 보냈다는 압박 → 즉시중지
   - 일반 의심 안내 → 일반

## 데모 시나리오 (심사위원 대상 3분)

1. **아들 사칭 급전 메시지** 붙여넣기 → `즉시중지` + 7개 필드 + 계좌 식별자가 "메시지 속 계좌"로만 표시됨 확인.
2. **새 연락처로 바꾸라는 메시지** → `먼저확인`.
3. **빈 메시지** → "메시지가 필요합니다" 안내 + 입력필요 처리.
4. **시크릿 창 재방문** → 별도 로그인 없이 안내가 먼저 나오고 분석 동작.

## 규칙/계약 (결선 규정 반영)

- **LLM**: Solar Pro 4 전용. 타 LLM(Claude, GPT 등)은 사용하지 않는다. (결선 그라운드룰)
- **키 정책**: 기본 동작은 **키 없이** 동작. Solar 호출 보강(P1)은 선택 사항이며, 키는 Vercel 환경변수에만 저장하고 화면 코드·응답 JSON·클라이언트 소스에 절대 노출되지 않는다.
- **예선 당선 스킬 필수 포함**: second-door 스킬의 규칙(7개 필드·분기 우선순위·금지 출력 범주·식별자 가리기)을 서비스 핵심 로직에 그대로 이식했다.
- **출력 계약**: 진위 판정, 점수/확률/%, 식별자 반복, 긴급·기관 번호 숫자 제시, 복구·환불·배상 보장을 하지 않는다.
- **MCP/데이터**: MCP 허용, 저작권 범위 내 데이터는 활용 가능. (결선 가이드)

## 기술 스택

- Next.js 16 (App Router)
- React 19
- TypeScript
- Vercel 배포 (서버리스 API Route `/api/analyze`)
- 규칙 기반 로직 (`mabc-second-door/src/app/api/analyze/route.ts`) — 키 없이 동작

## 저장소 구조

```
(생성형_AI_ 혜택과_위험_Challenge_대회_규정_및_유의사항.pdf 등 대회 자료)
(mabc2026-submission-final-check.md 등 제출 점검 문서)
(mabc-second-door/)                # Next.js 서비스 (Vercel 배포 대상)
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx           # 메인 페이지 ("use client")
│   │   │   ├── layout.tsx         # 루트 레이아웃
│   │   │   ├── globals.css        # 전역 스타일
│   │   │   └── api/
│   │   │       └── analyze/
│   │   │           └── route.ts   # 규칙 기반 7필드 로직 (키 없이 동작)
│   │   ├── public/
│   │   └── ...
│   ├── package.json
│   ├── next.config.ts
│   └── tsconfig.json
(submissions/)                     # 제출 산출물
│   ├── docs/
│   │   ├── README.md              # 제출용 개요 (이 파일이 루트 README)
│   │   └── prd.md                 # 미니 제품 요구사항 문서 (제출용)
│   ├── presentation/
│   │   └── presentation.html      # 발표 5장 (HTML)
│   └── skill/
│       ├── second-door.zip        # 예선 당선 스킬 원본
│       └── extracted/
│           └── SKILL.md           # 스킬 추출 마크다운
```

## 로컬에서 실행하기

```bash
cd mabc-second-door
npm install
npm run dev
# -> http://localhost:3000
```

## API

- `GET /api/analyze` → 서비스 정보 (건강 체크)
- `POST /api/analyze` → `{ "message": "..." }` 요청 시 7개 필드 응답

```bash
curl -s -X POST https://mabc-second-door.vercel.app/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"message":"엄마 나 아들인데 갑자기 급전이 필요해서 그래. 지금 바로 80만원만 계좌번호 3333-12-345678로 보내줄 수 있어? 빨리 해줘."}'
```

## 검증 (시크릿 창 / 키 미노출) — 실제 출력

### 1) 페이지 접속 확인 (2026-09-13)

```bash
$ curl -s -o /dev/null -w "%{http_code}\n" "https://mabc-second-door.vercel.app/"
200
```

### 2) 페이지 제목 확인

```bash
$ curl -s "https://mabc-second-door.vercel.app/" | grep -o '<title>[^<]*</title>'
<title>두번째문 — 의심 메시지 분석·확인 절차</title>
```

### 3) 공개 HTML에 API 키(up_) 포함 여부 — 0건

```bash
$ curl -s "https://mabc-second-door.vercel.app/" | grep -c "up_"
0
```

### 4) API 건강 체크 (GET)

```bash
$ curl -s "https://mabc-second-door.vercel.app/api/analyze"
{"service":"두번째문 (second-door) 분석 API","version":"0.1.0","note":"POST /api/analyze 에 { message: '...' } 로 요청"}
```

### 5) 시크릿 창 검증 (2026-09-13, ego-browser)

시크릿 창(저장값 없는 첫 방문)에서 페이지 접속 확인:

- 제목: "두번째문 — 의심 메시지 분석·확인 절차"
- 안내 문구: "의심스러운 문자, 카톡, 이메일, 메시지 내용을 그대로 붙여넣어 주세요. 최소 한 줄 이상."
- 예시 프리셋 4종 버튼: "아들 사칭 급전 메시지", "새 연락처로 바꾸라는 메시지", "이미 보냈으니 확인하라는 압박 메시지", "읽어볼 만한 의심 메시지 (일반)"
- 분석하기 버튼 표시
- localStorage 없이 첫 방문 기준으로도 정상 동작 확인

### 검증 체크리스트

- [x] 페이지 접속 시 안내 + 입력 폼이 먼저 보임 (위 5번 시크릿 창 확인)
- [x] POST `/api/analyze` 분석 동작 (7개 필드 응답)
- [x] 식별자(가상 계좌번호 등)가 출력에 그대로 반복되지 않음
- [x] `up_` API 키가 공개 HTML/클라이언트 소스에 노출되지 않음 (위 3번: 0건)
- [x] 페이지 제목: `두번째문 — 의심 메시지 분석·확인 절차` (위 2번)

## 제외 범위

- 메시지 진위 판정(사기/진짜/안전 등)을 하지 않음
- 실제 이체·링크 방문·설치·원격접속·자격증명 입력 대행하지 않음
- 긴급 기관 번호(112/119/1332/1366/1398/1345 등) 숫자를 제시하거나 지어내지 않음
- 복구·환불·배상·결과 보장 약속하지 않음
- 이미지 첨부 분석, 실시간 알림, 다국어 번역, 대량 동시 처리 등은 범위 밖

## 참고

- 예선 당선 스킬: second-door (두번째문) — 의심 메시지 진위 판정 없이 멈추고 확인하는 절차 정리 스킬
- 이 서비스는 그 스킬의 규칙·출력 계약을 서비스 핵심 로직으로 이식한 MVP다.
- Solar Pro 4 호출 보강은 선택 사항이며, 키 없이도 규칙 기반으로 7개 필드·분기·금지 패턴 검사가 동작한다.
