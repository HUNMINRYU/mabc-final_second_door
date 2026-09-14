<!-- prettier-ignore -->
<div align="center">

![두번째문 아이콘](./second-door-app-icon.svg)

# 두번째문 — 의심 메시지 분석·확인 절차 서비스

[![Node.js](https://img.shields.io/badge/Node.js->=20-3c873a?style=flat-square)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F68234?style=flat-square&logo=cloudflare)](https://workers.cloudflare.com/)
[![Platform](https://img.shields.io/badge/platform-Cloudflare%20Workers-191919?style=flat-square)](https://workers.cloudflare.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

[개요](#개요) • [데모](#데모) • [기능](#기능) • [공공데이터 출처](#공공데이터-출처) • [시작하기](#시작하기) • [환경변수](#환경변수) • [배포](#배포) • [Workers Builds](#workers-builds-git-연동) • [프로젝트 구조](#프로젝트-구조) • [규칙](#규칙)

</div>

> [!NOTE]
> 이 서비스는 의심 메시지의 **진위를 판정하지 않는다**. 멈추고, 이미 알고 있던 경로로 확인하는 절차만 정리한다. 개별 상황에 대한 법률·금융 조언이 아니며, 필요하면 112, 금융감독원(1332) 등 공식 창구로 확인한다.

## 개요

두번째문(second-door)은 문자·메신저·전화로 받은 의심 메시지를 넣어보면, **즉시중지 / 먼저확인 / 일반 / 입력필요** 중 어디로 연결되는지와 함께 규칙 기반 7필드 분석을 보여주는 웹 서비스다.

- **규칙 기반 7필드 출력**: 키 없이 동작한다. `NEXT_PUBLIC_UPSTAGE_API_KEY`가 있으면 판단이유 문장을 Solar로 보강할 수 있다(선택 사항).
- **공공데이터 출처 병기**: 금융감독원·국가정보원·경찰청·삼성생명·금융위원회·KISA 등 공개 예방정보를 요약해 출처와 함께 표시한다.
- **Cloudflare Workers 배포**: `secondoor.amooai.com`에서 서비스 중. GitHub Actions가 아니라 Cloudflare Workers Builds(Git 연동)로 자동 배포된다.

> [!CAUTION]
> API 키, 시크릿은 리포지토리에 커밋하지 않는다. 환경변수나 Cloudflare Workers 환경변수 설정으로 주입한다.

## 데모

![두번째문 심볼](./second-door-symbol.svg)

서비스의 분석 결과 모달은 Calendly 참조 스타일을 바탕으로 색·그림자·라운딩·타이포·간격을 맞췄다. 결과 팝업은 단일 오버레이로 유지하고, 토스트도 단일, 초기화 버튼과 Escape 키 닫기, 모달 스크롤 잠금 및 포커스 관리를 포함한다.

### 데모 시나리오 (심사위원 대상 3분)

1. **아들 사칭 급전 메시지** 붙여넣기 → `즉시중지` + 7개 필드 + 계좌 식별자가 "메시지 속 계좌"로만 표시됨 확인.
2. **새 연락처로 바꾸라는 메시지** → `먼저확인`.
3. **빈 메시지** → "메시지가 필요합니다" 안내 + 입력필요 처리.
4. **시크릿 창 재방문** → 별도 로그인 없이 안내가 먼저 나오고 분석 동작.

## 기능

- 의심 메시지 입력 → 분석 결과(상태, 중단조치, 확인할 주장, 독립확인, 답장 예시, 판단 이유, 하지 말 것)
- 결과 모달에서 공공데이터 출처, 사기유형 태그, 예방수칙, 참고 시나리오 표시
- 금지 패턴 검사 결과 표시 (진위·사기·진짜·가짜·안전 판정, 점수/확률/%, 긴급번호 숫자, 복구·환불·배상·보상 약속 등 미포함 확인)
- 예시 프리셋 4종 (아들 사칭 급전, 새 연락처 변경, 이미 보냈다는 압박, 일반 의심 메시지)
- 접근성: `prefers-reduced-motion` 미디어쿼리, 입력 필드 `autocomplete`/`name`/`placeholder` 보정, Skip Link, 모달 포커스 관리

## 공공데이터 출처

이 서비스는 다음 공개 정보를 요약·재구성해 사용한다. 원문을 그대로 전재하지 않고, 서비스 맥락에 맞게 요약하며 출처를 병기한다.

| 출처 | 사용 내용 |
|------|----------|
| 금융감독원 보이스피싱 예방안내 (fss.or.kr) | 예방 10계명, 피해 시 대응요령, 캠페인 문구 |
| 금융감독원 보도자료 2024.03.08 | 사기유형별 통계(대출빙자·메신저피싱·기관사칭 비중), 유형별 특징 |
| 국가정보원·경찰청 보이스피싱 8대 사기유형 카드뉴스 | 8대 사기유형 분류 체계 |
| 금융감독원·삼성생명 소비자경보 | 메신저피싱·정부지원 대출 빙자 시나리오, 소비자행동요령, 악성앱 대응 |
| 경찰청 전기통신금융사기 통합신고대응센터 보도자료 2024.10.24 | 기관사칭형 상세 시나리오, 피해 특징 |
| 금융감독원·KDI 피해자 설문조사 2021.06.30 | 연령별 접근 특징, 사기 인지 시간, 대응 요령 |
| 금융위원회 보이스피싱 대응 간담회 2026.03.26 | 신종스캠 유형, 대포계좌, 탐지 추진 방향 |
| KISA 보호나라 스미싱·피싱 예방수칙 2025.07.02 | 링크·URL 설치 유도형 대응 |

> [!IMPORTANT]
> 서비스 내 유형 태그는 위 출처들을 합친 **자체 분류**다. 개별 태그의 출처가 공식 문서에서 직접 확인되지 않은 조합이면 "유형 태그(참고)" 정도로 표시하고 확정적 출처 표기를 붙이지 않는다. 긴급·기관 번호(112, 1332 등)는 출력에 숫자로 병기하지 않고 범주로만 표현한다.

자세한 출처 목록과 이용 조건은 [공공데이터 소스 정리](./public-data-sources.md)를 참고한다.

## 시작하기

### 요구 도구

- [Node.js LTS](https://nodejs.org/) (>= 20)
- [pnpm](https://pnpm.io/) (또는 `corepack enable` 후 사용)
- [Git](https://git-scm.com/)
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) (배포 시)

### 로컬 실행

```bash
# 저장소를 클론한 뒤, 앱 디렉토리로 이동
cd mabc-second-door

# 의존성 설치
pnpm install

# 개발 서버 시작 (로컬 전용 .env.local이 있으면 함께 읽음)
pnpm dev
```

로컬에서는 `http://localhost:3000`에서 확인한다.

### Cloudflare Workers용 빌드 (로컬 확인용)

```bash
# OpenNext + Wrangler 빌드
pnpm build:cloudflare

# 미리보기 (로컬)
pnpm preview

# 배포 (wrangler 인증 필요)
pnpm deploy
```

> [!TIP]
> Workers Builds(Git 연동)를 사용하면 GitHub 푸시마다 Cloudflare가 자동으로 빌드·배포한다. 이 경우 `pnpm deploy`를 직접 실행할 필요는 없다.

## 환경변수

| 변수 | 용도 | 필수 여부 |
|------|------|-----------|
| `NEXT_PUBLIC_UPSTAGE_API_KEY` | Solar Pro 4 연동: 판단이유 문장 보강(선택 사항). 없으면 규칙 기반으로만 동작 | 선택 |
| `.env.local` (Vercel OIDC 토큰 등) | 로컬/베르셀 전용. Workers 빌드에는 사용하지 않음 | 해당 환경만 |

> [!CAUTION]
> API 키, 시크릿은 리포지토리에 커밋하지 않는다. 환경변수나 Cloudflare Workers 환경변수 설정으로 주입한다.

## 배포

### Cloudflare Workers (현재 배포 플랫폼)

- **Workers 이름**: `mabc-second-door`
- **커스텀 도메인**: `secondoor.amooai.com`
- **빌드 산출물**: `.open-next/worker.js` (OpenNext 빌드 결과)
- **assets binding**: `.open-next/assets`

로컬에서 배포를 직접 실행할 때는 `wrangler.jsonc`가 있는 디렉토리에서 `pnpm exec wrangler deploy --config wrangler.jsonc`를 사용한다. 이때 `CLOUDFLARE_API_TOKEN` 환경변수가 필요하다.

## Workers Builds (Git 연동)

이 저장소는 [Cloudflare Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/) (Git 연동)로 자동 배포된다. GitHub Actions 워크플로우(`.github/workflows/deploy.yml`)는 더 이상 사용하지 않는다.

Cloudflare 대시보드에서 해당 Worker의 Git integration을 설정하면, 지정된 브랜치에 푸시가 발생할 때마다 Cloudflare가 자동으로 빌드·배포한다. 모노레포 구조이므로 Root directory를 `mabc-second-door/`로 지정하고, 빌드 커맨드와 배포 커맨드를 아래와 같이 설정한다.

- **Root directory**: `mabc-second-door/`
- **Build command**: `pnpm install && pnpm build:cloudflare`
- **Deploy command**: `pnpm exec wrangler deploy --config wrangler.jsonc`

> [!NOTE]
> Workers Builds는 Cloudflare 측 인증으로 배포하므로, GitHub Actions의 `CLOUDFLARE_API_TOKEN` 시크릿과 달리 별도 시크릿 등록이 필요하지 않을 수 있다. Workers 환경변수(필요한 경우)는 Cloudflare 대시보드에서 설정한다.

## 프로젝트 구조

```
mabc-final_second_door/
├── mabc-second-door/          # 앱 루트
│   ├── src/
│   │   └── app/               # Next.js 앱 라우트 (페이지, API)
│   │       ├── page.tsx       # 메인 페이지 ("use client")
│   │       ├── layout.tsx     # 루트 레이아웃
│   │       ├── globals.css    # 전역 스타일 (Calendly 참조)
│   │       └── api/
│   │           └── analyze/
│   │               └── route.ts   # 규칙 기반 7필드 로직 (키 없이 동작)
│   ├── public/                # 정적 자산
│   ├── .open-next/            # OpenNext 빌드 산출물 (Git 제외)
│   ├── open-next.config.ts    # OpenNext Cloudflare 설정
│   ├── wrangler.jsonc         # Workers 배포 설정 (name, main, assets)
│   ├── package.json           # 의존성 및 스크립트
│   ├── next.config.ts         # Next.js 설정
│   ├── tsconfig.json          # TypeScript 설정
│   ├── eslint.config.mjs      # ESLint 설정
│   └── .gitignore             # Git 추적 제외
├── second-door-app-icon.svg   # 프로젝트 아이콘
├── second-door-symbol.svg     # 프로젝트 심볼
├── public-data-sources.md     # 공공데이터 출처 상세 문서
└── README.md                  # 이 파일
```

빌드 산출물(`.next/`, `.open-next/`, `.vercel/`, `.wrangler/`, `node_modules/`, `pnpm-lock.yaml`, `package-lock.json`, `.env.local` 등)은 Git에서 제외한다.

## 규칙

- **LLM**: Solar Pro 4 전용. 타 LLM(Claude, GPT 등)은 사용하지 않는다. (MABC 결선 그라운드룰)
- **키 정책**: 기본 동작은 **키 없이** 동작. Solar 호출 보강은 선택 사항이며, 키는 환경변수에만 저장하고 화면 코드·응답 JSON·클라이언트 소스에 절대 노출되지 않는다.
- **예선 당선 스킬 필수 포함**: second-door 스킬의 규칙(7개 필드·분기 우선순위·금지 출력 범주·식별자 가리기)을 서비스 핵심 로직에 그대로 이식했다.
- **출력 계약**: 진위 판정, 점수/확률/%, 식별자 반복, 긴급·기관 번호 숫자 제시, 복구·환불·배상 보장을 하지 않는다.
- **MCP/데이터**: MCP 허용, 저작권 범위 내 데이터는 활용 가능. (MABC 결선 가이드)
- **제출용 문서**: 제출 산출물(PRD, 발표 자료, 스킬 원본 등)은 저장소 내 별도 제출 폴더에 관리한다.

---

이 README는 awesome-copilot의 [create-readme](https://github.com/github/awesome-copilot/tree/main/skills/create-readme) 스킬 방식을 참고해 작성했다: GFM, GitHub admonition, 간결한 서술, 아이콘 활용, 이모지 과용 금지.
