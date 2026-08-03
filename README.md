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

## AI 활용 및 증빙

Twin World는 **Upstage Solar LLM(`solar-pro2`)**을 자연어 시나리오 구조화와 시뮬레이션 결과 분석에 활용합니다.

AI는 군중 물리 시뮬레이션이나 MR2S 최적화를 대신 실행하지 않습니다. 사용자의 자연어 입력과 시뮬레이션에서 산출된 정량 지표를 사람이 이해하고 활용하기 쉬운 형태로 변환하는 역할을 담당합니다.

### 1. 자연어 시나리오 구조화

사용자는 다음과 같이 행사 상황을 자연어로 입력할 수 있습니다.

```text
오후 6시부터 북쪽 입구로 3,000명이 유입되고 공연 종료 후 남쪽 출구로 이동한다.
```

Solar LLM은 입력 문장에서 시뮬레이션에 필요한 인원수를 추출하고 사용자가 확인할 수 있는 한국어 요약을 생성합니다.

```json
{
  "population": 3000,
  "summary": "오후 6시부터 북쪽 입구로 3,000명이 유입되는 시나리오입니다.",
  "warnings": []
}
```

처리 흐름은 다음과 같습니다.

1. 사용자가 시뮬레이션 화면에 자연어 시나리오 입력
2. 프런트엔드에서 `/api/scenario` 호출
3. 서버에서 Upstage Solar LLM API 호출
4. LLM 응답을 JSON으로 파싱하고 값 검증
5. 사용자가 결과를 확인한 뒤 시뮬레이션에 직접 적용

AI가 인원수를 인식하지 못하면 기본값을 사용합니다. 인원수는 시뮬레이션 안정성을 위해 서버에서 `1~5,000명` 범위로 제한합니다.

### 2. 시뮬레이션 결과 분석 보고서

기준안과 MR2S 최적화안의 시뮬레이션이 실행되면 다음 정량 지표를 Solar LLM에 전달합니다.

- 도착률
- 95% 대피 완료 시간
- 고압력 위험 노출 인원
- 병목 구간 수
- 시뮬레이션 인원수
- 장소의 노드 및 간선 수

Solar LLM은 전달된 지표를 기반으로 다음 구조의 분석 결과를 생성합니다.

```json
{
  "summary": "기준안과 최적화안의 주요 차이를 설명하는 요약",
  "causes": [
    {
      "title": "주요 위험 요인",
      "evidence": "시뮬레이션 지표에 기반한 근거"
    }
  ],
  "recommendations": [
    {
      "title": "운영 개선 제안",
      "expectedEffect": "제안 적용 시 기대 효과"
    }
  ],
  "limitations": [
    "분석 결과를 해석할 때 고려해야 하는 가정과 한계"
  ]
}
```

생성된 보고서는 웹 화면에서 확인하거나 Markdown 파일로 내려받을 수 있습니다.

### 3. AI 연동 구조

```text
사용자 자연어 입력
        ↓
프런트엔드
        ↓
Twin World 서버 API
        ↓
Upstage Solar LLM
        ↓
JSON 응답 검증
        ↓
사용자 확인 및 시뮬레이션 적용
```

시뮬레이션 보고서는 다음 흐름으로 생성됩니다.

```text
Social Force Model 시뮬레이션
        ↓
기준안·최적화안 정량 지표 계산
        ↓
Twin World 서버 API
        ↓
Upstage Solar LLM 분석
        ↓
분석 보고서 표시 및 Markdown 내보내기
```

### 4. 구현 코드 증빙

| 구분 | 구현 파일 | 내용 |
| --- | --- | --- |
| Upstage API 클라이언트 | `api/_lib/upstage.ts` | Solar Chat Completions API 호출, 인증 및 JSON 응답 처리 |
| 시나리오 구조화 | `api/_lib/scenarioHandler.ts` | 자연어에서 인원수와 시나리오 요약 추출 |
| 보고서 생성 | `api/_lib/reportHandler.ts` | 기준안과 최적화안의 지표를 이용한 원인·권고안·한계 생성 |
| 서버 API 엔드포인트 | `api/scenario.ts` | 시나리오 구조화 API 제공 |
| 서버 API 엔드포인트 | `api/report.ts` | AI 분석 보고서 API 제공 |
| 프런트엔드 API 모듈 | `src/api/upstageClient.ts` | 브라우저와 자체 서버 API 연결 |
| 시나리오 입력 화면 | `src/components/simulation/ScenarioInput.tsx` | 자연어 입력, AI 분석 결과 확인 및 적용 |
| 분석 보고서 화면 | `src/components/comparison/ReportPanel.tsx` | 보고서 생성, 표시 및 Markdown 내보내기 |
| 시나리오 API 테스트 | `api/_lib/scenarioHandler.test.ts` | 정상 응답, 범위 제한, 오류 처리 검증 |
| 보고서 API 테스트 | `api/_lib/reportHandler.test.ts` | 보고서 파싱 및 Upstage API 오류 처리 검증 |

### 5. 실제 API 호출 정보

서버에서는 다음 Upstage API를 호출합니다.

```text
POST https://api.upstage.ai/v1/solar/chat/completions
```

주요 요청 설정은 다음과 같습니다.

```json
{
  "model": "solar-pro2",
  "messages": [],
  "response_format": {
    "type": "json_object"
  }
}
```

`response_format`을 `json_object`로 지정해 후속 코드에서 검증할 수 있는 구조화된 응답을 받습니다.

### 6. API 키 보안

`UPSTAGE_API_KEY`는 브라우저에서 직접 사용하지 않습니다.

- API 키는 서버 전용 환경변수로 관리
- 브라우저는 Twin World의 `/api/scenario`, `/api/report`만 호출
- 실제 Upstage API 호출은 `api/` 서버 코드에서만 수행
- API 키가 포함된 `.env.local`은 Git 저장소에 커밋하지 않음
- Vercel 배포 환경에서는 프로젝트 환경변수로 별도 등록

따라서 빌드된 프런트엔드 코드와 브라우저 네트워크 요청에 Upstage API 키가 노출되지 않습니다.

### 7. AI 결과 안전장치

LLM의 출력을 그대로 시뮬레이션에 적용하지 않고 다음 검증 절차를 거칩니다.

- 시나리오 API 요청값 유효성 검사
- LLM 응답의 JSON 형식 검사
- 인원수의 숫자 여부 검사
- 인원수를 `1~5,000명` 범위로 제한
- 값이 없거나 올바르지 않으면 기본 인원수 사용
- AI가 제안한 인원수는 사용자가 확인 버튼을 눌러야 적용
- 보고서가 입력받지 않은 사고·사상자 정보를 생성하지 않도록 프롬프트에서 제한
- AI 권고안은 자동 적용하지 않고 관리자 검토 대상으로만 표시
- Upstage 설정 오류와 API 오류를 구분해 처리

### 8. AI 기능 재현 방법

#### 자연어 시나리오 구조화

1. `.env.local`에 `UPSTAGE_API_KEY` 설정
2. `npm run dev` 실행
3. 3D 시뮬레이션 화면으로 이동
4. 자연어로 행사 상황과 예상 인원 입력
5. `AI로 인원수 구조화` 버튼 클릭
6. AI가 추출한 인원수와 요약 확인
7. `이 인원수 적용` 버튼을 눌러 시뮬레이션에 반영

#### 분석 보고서 생성

1. 기준안과 MR2S 최적화안 시뮬레이션 실행
2. 결과 비교 화면으로 이동
3. `AI 분석 보고서 생성` 버튼 클릭
4. 요약, 주요 원인, 개선 권고안 및 분석 한계 확인
5. `Markdown 내보내기` 버튼으로 보고서 저장

#### 자동 테스트

```bash
npm run test
```

테스트에서는 다음 항목을 검증합니다.

- 정상적인 시나리오 구조화 응답
- 비정상 인원수의 범위 제한
- 인원수가 없는 응답의 기본값 처리
- 분석 보고서 JSON 파싱
- Upstage API 설정 오류 처리
- Upstage API 요청 실패 처리


## 사용 시 유의사항

- 실제 대규모 군중 운영에 적용하기 전 현장 데이터와 전문가 검토가 필요합니다.
- 시뮬레이션 결과는 입력한 그래프, 인원수, 이동 조건에 따라 달라집니다.
- AI 분석 보고서는 시뮬레이션 결과의 이해를 돕기 위한 보조 자료입니다.
- MR2S 백엔드에 연결할 수 없는 경우 일방통행 최적화 기능이 제한될 수 있습니다.
