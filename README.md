# Twin World

**Twin World**는 축제·행사 공간의 군중 밀집 위험을 분석하는 디지털 트윈 시뮬레이션 서비스입니다.

부산 축제거리 그래프를 편집하고 MR2S를 이용해 일방통행 동선을 최적화한 뒤, Social Force Model 기반 3D 군중 시뮬레이션을 실행합니다. 기준안과 최적화안의 밀집도, 병목 구간, 대피시간을 비교하고 Upstage Solar LLM으로 분석 보고서를 생성할 수 있습니다.

> 배포된 데모: https://twin-world.vercel.app

## 주요 기능

- 부산 축제거리 프리셋 및 사용자 정의 그래프 생성
- 노드·간선 기반 보행 동선 편집
- MR2S 기반 일방통행 동선 최적화
- Dijkstra 알고리즘 기반 에이전트 경로 탐색
- Social Force Model 기반 3D 군중 시뮬레이션
- 군중 밀집도 히트맵 및 병목 구간 시각화
- 기준안과 최적화안의 시뮬레이션 결과 비교
- Upstage Solar LLM 기반 자연어 시나리오 구조화
- AI 분석 보고서 생성 및 Markdown 내보내기

## 서비스 흐름

### 1. 프로젝트 및 장소 선택

부산 축제거리 프리셋을 선택하거나 새로운 그래프로 시작합니다.

### 2. 그래프 편집

시뮬레이션에 사용할 노드와 간선을 추가하거나 수정합니다.

`MR2S 일방통행 최적화` 버튼을 누르면 실제 MR2S 백엔드를 호출해 최적화된 이동 방향을 계산합니다.

### 3. 3D 군중 시뮬레이션

Dijkstra 경로 탐색과 Social Force Model을 기반으로 에이전트의 이동을 시뮬레이션합니다.

시뮬레이션 화면에서 다음 정보를 확인할 수 있습니다.

- 에이전트 이동 경로
- 구간별 군중 밀집도
- 밀집도 히트맵
- 병목 구간
- 고압력 위험 노출
- 도착 인원 및 도착률
- 시뮬레이션 경과 시간

자연어로 시나리오를 입력하면 Upstage Solar LLM이 인원수 등의 조건을 구조화합니다.

### 4. 결과 비교

기준안과 MR2S 최적화안의 결과를 비교합니다.

- 도착률
- 대피시간
- 병목 구간
- 군중 밀집도
- 고압력 위험 노출

시뮬레이션 결과를 바탕으로 AI 분석 보고서를 생성하고 Markdown 파일로 내보낼 수 있습니다.

## 핵심 기술

### MR2S 동선 최적화

그래프의 간선 방향을 최적화해 양방향 보행으로 발생하는 충돌과 병목을 줄입니다.

로컬 개발 환경에서는 Vite 프록시를 통해 MR2S 백엔드를 호출하고, Vercel 배포 환경에서는 `vercel.json`의 프록시 설정을 사용합니다.

### Dijkstra 경로 탐색

각 에이전트가 현재 그래프 구조에서 목적지까지 이동할 수 있도록 최단 경로를 계산합니다.

### Social Force Model

에이전트의 목적지 이동력과 다른 에이전트 및 장애물에 대한 반발력을 계산해 군중의 움직임을 시뮬레이션합니다.

### Upstage Solar LLM

다음 기능에 Upstage Solar LLM을 사용합니다.

- 자연어 시나리오에서 인원수와 조건 추출
- 시뮬레이션 결과 요약
- 기준안과 최적화안 비교
- 병목 및 고밀집 위험 구간 분석
- 운영 개선 방안을 포함한 보고서 생성

Upstage API 키가 없어도 그래프 편집, MR2S 최적화, 3D 시뮬레이션 기능은 정상적으로 사용할 수 있습니다.

## 로컬 실행 가이드

### 요구 사항

- Node.js `20.19+` 또는 `22.12+`
- npm
- Upstage API 키
  - 자연어 시나리오 구조화와 AI 분석 보고서 기능에만 필요합니다.

Vite 7의 요구 버전에 따라 Node.js `20.19+` 또는 `22.12+` 사용을 권장합니다. Node.js `20.18.x`에서도 경고와 함께 대부분 동작하지만 권장 환경은 아닙니다.

### 저장소 클론

```bash
git clone <REPOSITORY_URL>
cd twin-world
```

### 의존성 설치

```bash
npm install
```

### 환경변수 설정

`.env.example`을 복사해 `.env.local`을 생성합니다.

macOS 또는 Linux:

```bash
cp .env.example .env.local
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

생성한 `.env.local`에 필요한 값을 입력합니다.

```env
UPSTAGE_API_KEY=your_upstage_api_key
VITE_PROXY_TARGET=https://quantum.yunseong.dev
```

### 개발 서버 실행

```bash
npm run dev
```

개발 서버가 실행되면 다음 주소에서 확인할 수 있습니다.

```text
http://localhost:5173
```

다음 API는 Vite 개발 서버 미들웨어를 통해 로컬에서도 동작합니다.

- `/api/scenario`
- `/api/report`
- `/mr2s-api/*`

따라서 로컬 전체 기능 테스트를 위해 Vercel CLI를 별도로 실행할 필요가 없습니다.

## 환경변수

| 변수 | 필수 여부 | 설명 |
| --- | --- | --- |
| `UPSTAGE_API_KEY` | AI 기능 사용 시 필수 | 자연어 시나리오 구조화 및 AI 분석 보고서 생성에 사용합니다. 서버 전용 코드인 `api/`에서만 읽으며 브라우저에 노출되지 않습니다. |
| `VITE_PROXY_TARGET` | 선택 | 로컬 개발 환경에서 사용할 MR2S 백엔드 프록시 대상입니다. 기본값은 `https://quantum.yunseong.dev`입니다. |

> `UPSTAGE_API_KEY`와 `.env.local`은 Git 저장소에 커밋하지 마세요.

## 테스트

```bash
npm run test
```

## 프로덕션 빌드

```bash
npm run build
```

빌드 결과를 로컬에서 확인하려면 다음 명령을 실행합니다.

```bash
npm run preview
```

## 실행 및 배포 환경

| 구분 | 환경 |
| --- | --- |
| JavaScript 런타임 | Node.js `20.19+` 또는 `22.12+` |
| 개발 및 빌드 도구 | Vite 7 |
| 배포 플랫폼 | Vercel |
| AI API | Upstage Solar LLM |
| 동선 최적화 백엔드 | MR2S API |
| 로컬 개발 주소 | `http://localhost:5173` |
| 배포 주소 | https://twin-world.vercel.app |

## Vercel 배포

Vercel CLI를 사용해 프로덕션 환경에 배포합니다.

```bash
npx vercel --prod
```

배포 전 Vercel 프로젝트 설정에서 `UPSTAGE_API_KEY`를 환경변수로 등록해야 합니다.

필요에 따라 다음 환경에 각각 등록합니다.

- Production
- Preview
- Development

`vercel.json`은 `/mr2s-api/*` 요청을 MR2S 백엔드로 프록시합니다.

## 프로젝트 구조

```text
twin-world/
├── api/                 # Upstage 연동 서버 API
├── src/                 # 프런트엔드 애플리케이션
├── public/              # 정적 파일
├── .env.example         # 환경변수 예시
├── package.json         # 프로젝트 스크립트 및 의존성
├── vercel.json          # Vercel 배포 및 프록시 설정
└── README.md
```

## 사용 시 유의사항

- 실제 대규모 군중 운영에 적용하기 전 현장 데이터와 전문가 검토가 필요합니다.
- 시뮬레이션 결과는 입력한 그래프, 인원수, 이동 조건에 따라 달라집니다.
- AI 분석 보고서는 시뮬레이션 결과의 이해를 돕기 위한 보조 자료입니다.
- MR2S 백엔드에 연결할 수 없는 경우 일방통행 최적화 기능이 제한될 수 있습니다.
