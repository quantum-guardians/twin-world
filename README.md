# Twin World

다중밀집 사고(군중 밀집) 시뮬레이션 MVP. 부산 축제거리 그래프를 편집하고, MR2S로 일방통행 동선을 최적화한 뒤, Social Force Model 기반 3D 군중 시뮬레이션으로 기준안과 최적화안의 밀집도·병목·대피시간을 비교하고 Upstage Solar LLM으로 분석 보고서를 생성합니다.

**배포된 데모**: https://twin-world.vercel.app

## 실행 방법

### 요구 사항

- Node.js 20.19+ 또는 22.12+ (Vite 7 요구 버전. 로컬 개발 시 20.18.x에서도 경고만 뜨고 대체로 동작하지만 권장하지 않습니다)
- Upstage API 키 — 자연어 시나리오 구조화·AI 분석 보고서 기능에만 필요합니다. 없어도 그래프 편집·3D 시뮬레이션·MR2S 최적화는 정상 동작합니다.

### 설치

```bash
npm install
```

### 환경 변수

`.env.example`을 복사해 `.env.local`을 만들고 값을 채웁니다.

```bash
cp .env.example .env.local
```

| 변수 | 필수 여부 | 설명 |
| --- | --- | --- |
| `UPSTAGE_API_KEY` | AI 기능 사용 시 | 서버 전용 코드(`api/`)에서만 읽으며 브라우저에 노출되지 않습니다. |
| `VITE_PROXY_TARGET` | 아니오 | MR2S 백엔드 로컬 프록시 대상. 기본값은 배포된 `https://quantum.yunseong.dev`. |

### 개발 서버 실행

```bash
npm run dev
```

`http://localhost:5173`에서 확인합니다. `/api/scenario`, `/api/report`(Upstage 연동)도 Vite dev 서버 미들웨어를 통해 그대로 로컬에서 동작하므로 Vercel CLI 없이 전체 기능을 테스트할 수 있습니다.

### 테스트

```bash
npm run test
```

### 프로덕션 빌드

```bash
npm run build
```

### 배포 (Vercel)

```bash
npx vercel --prod
```

Vercel 프로젝트에 `UPSTAGE_API_KEY`가 Production/Preview/Development 환경 변수로 등록되어 있어야 하며, `vercel.json`이 `/mr2s-api/*` 요청을 MR2S 백엔드로 프록시합니다.

### 주요 화면 흐름

1. **프로젝트/장소 선택** — 부산 축제거리 프리셋 또는 새 그래프로 시작
2. **그래프 편집** — 노드·간선 편집, `MR2S 일방통행 최적화` 버튼으로 실제 배포된 MR2S 백엔드 호출
3. **3D 시뮬레이션** — Dijkstra 경로탐색 + Social Force Model 기반 에이전트 이동, 밀집도 히트맵, AI 자연어 시나리오 구조화(인원수)
4. **결과 비교** — 기준안(양방향)과 최적화안(MR2S)의 도착률·대피시간·병목·고압력 위험 노출 비교, AI 분석 보고서 생성 및 Markdown 내보내기

---

# AI Builder Sprint 2026

> 총 168시간, AI와 함께 만드는 도전

## 대회 소개

**AI Builder Sprint 2026**은 부산대학교 **APPTIVE**가 주최하고, **Upstage**, 부산대학교 **Anchor 사업단** 및 부산대학교 **AI융합교육원**이 후원하는 해커톤입니다. 참가자들은 자유로운 기술 스택을 바탕으로 실제로 동작하는 서비스를 직접 코드로 구현합니다.

| 항목 | 내용 |
| --- | --- |
| 주제 | AI를 통해 인간다움을 더욱 잘 드러낼 수 있는 서비스 개발 |
| 팀 구성 | 2~4인 1팀 |
| 개발 방식 | 코드 기반 앱 개발 필수 (노코드/로우코드 단독 사용 불가) |

### 진행 흐름

1. **팀 단위 참가 신청** — 팀원 정보, 프로젝트 아이디어, 활용 예정 AI 기술·API 제출
2. **참가팀 선발** (20~50팀) — 아이디어 참신성·실현 가능성·AI 활용 계획 기반 서류 심사
3. **예선 개발 기간** (7.27 ~ 8.3, 약 1주일) — API 크레딧 발급, 아이디어 구체화 및 개발
4. **결과물 제출 및 1차 심사** — 데모 영상/배포 링크, 코드 저장소, 발표 자료, AI 활용 증빙 제출
5. **본선 발표 및 질의응답** (8.7) — 팀당 7분 발표 + 5분 Q&A, 심사 후 수상팀 확정

### 기술 스택 및 규칙

- 사용 API·모델은 자유이며, **Upstage API**(Solar LLM, Document Parse, Information Extract) 활용 시 심사 가점
- Claude, GPT, Gemini 등 타사 모델 병행 사용 가능 (제약 없음)
- 프레임워크/언어 자유 (Python, JavaScript, React, Flutter 등)
- 결과물은 데모 가능한 동작하는 앱 (웹앱, 모바일앱, CLI 도구 등 형태 무관)
- 코딩 에이전트(Claude Code, Codex 등) 활용 시 `.claude/`, `AGENTS.md` 등 관련 설정·지침 파일을 저장소에 포함해야 심사에 반영됩니다

### 심사 기준

| 기준 | 배점 |
| --- | --- |
| 창의성 | 20점 |
| AI 활용도 | 20점 |
| 완성도 | 20점 |
| 실용성 | 20점 |
| 발표력 (본선) | 20점 |
| Upstage API 활용 가점 | +5점 |
| 지역사회 기여도 가점 | +5점 |

### 시상 내역

- 대상 1팀: 100만원 + 상품
- 최우수상 1팀: 50만원 + 상품
- 우수상 1팀: 상품
- 본선 참가 10팀: Upstage 굿즈 + 참가 인증서

## Git Fork 하는 방법

참가팀은 이 저장소를 팀 대표의 GitHub 계정으로 **Fork**한 뒤, 해당 Fork 저장소에서 프로젝트를 개발하고 최종 결과물을 제출합니다.

### 1. 저장소 Fork하기

1. [AI-Builder-Sprint 저장소](https://github.com/ApptiveDev/AI-Builder-Sprint)에 접속합니다.
2. 우측 상단의 **Fork** 버튼을 클릭합니다.
  <img width="1888" height="1131" alt="스크린샷 2026-07-27 오전 12 31 16" src="https://github.com/user-attachments/assets/2f0f7f80-6c92-4ba5-87c5-89ed6107eeab" />

3. 본인(또는 팀 대표) GitHub 계정으로 저장소가 복사됩니다. (`https://github.com/<내-계정>/AI-Builder-Sprint`)

### 2. Fork한 저장소 로컬로 클론하기

```bash
git clone https://github.com/<내-계정>/AI-Builder-Sprint.git
cd AI-Builder-Sprint
```

### 3. 개발 진행 및 커밋

```bash
git checkout -b develop
# 코드 작성 및 수정
git add .
git commit -m "feat: 프로젝트 초기 구현"
git push origin develop
```

포크된 저장소 내에서 개발을 진행해주시면 됩니다.

### 4. 결과물 제출

- **팀별로 Fork한 본인 저장소 URL을 제출 양식에 기재합니다.**
- 제출 마감 전까지 코드, 데모 영상/배포 링크, 발표 자료를 함께 준비해 제출해주세요.
- 코딩 에이전트를 활용한 경우 `.claude/`, `AGENTS.md` 등 설정 파일도 반드시 저장소에 포함해주세요.


## 문의

- 대회 관련 문의: 해커톤 문의 오픈채팅방
- 주최: 부산대학교 APPTIVE, 정보컴퓨터공학부 동아리연합회 / 후원: Upstage, 부산대 Anchor 사업단, 부산대 AI융합교육원
