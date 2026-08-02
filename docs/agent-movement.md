# 에이전트 이동 로직 문서

MR2S 군중 시뮬레이션(top-down, 2D)에서 에이전트가 어떻게 움직이는지 정리한 문서입니다.
소스 코드 주석은 영어로 작성되어 있고, 이 문서는 향후 새 시뮬레이션 작업 시 참고용으로 한글로 정리했습니다.

## 1. 아키텍처 개요

- **렌더링**: `src/components/TopViewCanvas.tsx`의 `<canvas>` 하나에 `CanvasRenderingContext2D`로 직접 그림(`src/simulation/draw.ts`). PixiJS/Konva 같은 캔버스 라이브러리는 사용하지 않음.
- **메인 루프**: `TopViewCanvas.tsx:292-404`의 `useEffect`(deps `[]`) 안에서 `requestAnimationFrame` 루프(`tick`, line 299)가 컴포넌트 생명주기 동안 계속 돎. 재생/일시정지는 effect를 재구독하지 않고 `isPlayingRef`로 게이팅.
- **고정 타임스텝**: `FIXED_DT_MS = 1000/60`(`socialForce.ts:70`) 단위로 물리를 누적(accumulator `acc`) 시뮬레이션. 프레임당 최대 12스텝까지만 처리(백그라운드 탭 복귀 시 "spiral of death" 방지, `TopViewCanvas.tsx:341,361`).
- **상태 관리**: Redux/Zustand 없음. `App.tsx`는 일반 `useState`, `TopViewCanvas.tsx`는 60Hz 루프의 리렌더 비용을 피하기 위해 `useRef`로 물리 월드/에이전트 배열을 보관.
- **경로탐색**: 그래프 기반 Dijkstra(`agents.ts`)를 사용. A* 그리드 방식이 아님.

## 2. 에이전트 데이터 모델 (2계층 구조)

물리 계층과 행동/경로 계층이 분리되어 있고, 공통 `id`로 연결됨(`world.agents.get(agent.id)`).

### 2.1 물리 계층 — `SfmAgent` (`src/simulation/socialForce.ts:45-55`)
- `id`, `position: Point`, `velocity: Point`, `radius`
- `SfmWorld`: `walls: WallSegment[]`, `agents: Map<string, SfmAgent>`

### 2.2 행동/경로 계층 — `AgentRuntimeState` (`src/simulation/agents.ts:167-190`)
- `id`, `waypoints: Point[]`, `waypointIndex`
- `startLeaf` / `targetLeaf` (경로 시작·끝 노드)
- `state: "moving" | "arrived" | "dead"`
- `speedFactor?` — 스폰 시 고정되는 개인별 속도 배율
- `stuckTicks?` — 정체(임패이션스) 추적
- `lastWaypointDistance?` — 진행도 추적
- `pressure?`, `highPressureTicks?` — 압사/사망 시스템용

### 2.3 매 틱 조향 의도 — `DesiredMotion` (`socialForce.ts:59-68`)
- `ex, ey`(단위 방향 벡터), `speed`, `minForwardSpeed?`, `socialScale?`

## 3. 이동 알고리즘 — Social Force Model (SFM)

Helbing & Molnár(1995) / Helbing(2000)의 사회적 힘 모델을 기반으로, "경로 우선(route-priority)"을 위한 최소 전진속도 보장을 결합한 하이브리드 방식. Boid류 스티어링이나 순수 벡터필드 방식이 아님.

### 메인 틱 순서 (`TopViewCanvas.tsx:340-359`, 고정 스텝 while 루프 내부)

```
continueArrivedAgents        // 도착한 에이전트에 새 목적지 배정
  → computeDesiredDirections // 조향: 목표 방향/속도 계산
  → stepSocialForce          // 물리 적분: SFM 힘 계산 + 속도/위치 갱신
  → constrainAgentsToRoutes  // 차선 이탈 보정
  → updatePressureDeaths     // 압사 사망 판정
```

### 3.1 조향 단계 — `computeDesiredDirections` (`agents.ts:292-395`)

각 `moving` 상태 에이전트에 대해:
1. 현재 웨이포인트를 향한 방향 계산. 우측통행을 위해 `rightLaneTarget`(`agents.ts:26-39`)으로 차선 중심선에서 오프셋(`AGENT_LANE_OFFSET = 5px`).
2. 도착 판정: 거리 기반 또는 웨이포인트를 "지나쳤는지" 평면 교차 테스트(line 319-328) → `waypointIndex` 증가.
3. **임패이션스(정체 탈출) 메커니즘** (line 351-384):
   - 진행이 멈추면 `stuckTicks` 누적
   - `STUCK_PATIENCE_TICKS`(1.5초) 이후부터 `STUCK_RAMP_TICKS`(2초)에 걸쳐 속도 부스트(`STUCK_BOOST_MAX = 1`, 최대 100% 증가)와 우측 각도 지터(`STUCK_JITTER_MAX_RAD = 22.5°`)를 점점 강하게 적용
   - 오래 정체될수록 장거리 사회적 반발력 스케일(`socialScale`)을 줄여 병목에서의 아치(막힘) 현상을 깨뜨림
   - 순수 속도 증가만으로는 기하학적 아치를 못 깨므로, 지터(방향 흔들림 ξ)가 실제 탈출 트리거 역할

### 3.2 물리 적분 단계 — `stepSocialForce` (`socialForce.ts:298-516`)

60Hz 틱을 `MAX_STEP_DISPLACEMENT_PX` 기준으로 서브스텝 분할. 각 서브스텝마다:

1. **에이전트 간 반발력**: 지수형 사회적 힘 `A·exp((r-d)/B)` (line 358-376). 이동 방향 기준 비등방성(anisotropic, `SFM_ANISOTROPY_LAMBDA = 0.5`) — 앞사람은 강하게, 뒷사람은 약하게 회피. 겹칠 경우 몸체 접촉 스프링+마찰력 추가(line 385-405, `SFM_K_BODY`, `SFM_KAPPA`).
2. **벽 반발력**: 복도 벽 세그먼트별 반발력 계산(line 413-439, `SFM_A_WALL = 500`, 에이전트보다 강함 → 벽을 뚫기보다 벽을 따라 눌리게 함).
3. **속도 적분**: semi-implicit Euler로 `velocity += (목표방향 구동력 + 반발력) * dt` (line 442-490). 구동력은 `SFM_TAU(0.5초)` 완화시간으로 `DesiredMotion`을 향해 속도를 수렴시키는 고전 SFM 항.
4. **속도 상한/하한**:
   - 상한: `SFM_SPEED_FACTOR(1.3) × 목표 속도`
   - 하한: `minForwardSpeed` 플로어(line 478-486) — SFM 힘 균형 상태에서도 경로 진행을 강제하는 하이브리드 보장 장치
5. **기하학적 보정**:
   - `resolveAgentOverlaps`(line 168-217): 겹친 몸체를 위치적으로 밀어냄
   - `resolveWallCollisions`(line 230-289): 벽 안쪽으로 되돌리고, 외적 부호 반전으로 벽 통과를 감지, 접촉 시 안쪽 속도 성분 제거
   - 위치 보정이 속도 레벨의 `minForwardSpeed` 보장을 상쇄할 수 있어, 보정 후 다시 한 번 전진 변위를 재적용(line 498-514)

### 3.3 차선 구속 — `constrainAgentsToRoutes` (`agents.ts:432-478`)

물리 스텝 이후, 각 에이전트를 현재 방향성 차선 세그먼트(그래프 엣지에서 `rightNormal`로 오프셋)의 최근접점에 투영하고, 횡방향 이탈을 `maxLateralDistance`(기본 8px)로 클램프. 전진 진행량은 되돌리지 않음.

### 3.4 (참고, 현재 미사용) `enforceContainment` (`agents.ts:494-512`)

`isPointInWalkableArea`(복도 사각형 + 허브 원판, `corridors.ts:145-160`)로 걸을 수 있는 영역 이탈을 매 틱 검사, 이탈 시 `lastValidPositions`로 스냅백하고 속도 0으로 리셋하는 하드 백스톱. **현재 `TopViewCanvas.tsx`의 틱 루프에서는 호출되지 않고** `constrainAgentsToRoutes`가 대신 사용됨 — 실제 라이브 동작과 다를 수 있어 문서화 시 주의.

### 3.5 경로탐색 — `shortestPath` (`agents.ts:98-145`)

`buildAdjacency`(`agents.ts:78-96`)로 만든 그래프에 대한 순수 배열 기반 Dijkstra. 단방향(솔버 지향) 엣지와 양방향 엣지를 모두 지원.

## 4. 연관 시스템

### 4.1 압사 사망 모델 (`src/simulation/pressure.ts`)

- `computeAgentPressures(world)` (line 38-81): 동시다발적 근접 접촉(이웃 에이전트 + 벽)으로부터 압축도 추정(`compressionFromGap`, line 26-31, `PRESSURE_CONTACT_RANGE_PX = 3`).
- `updatePressureDeaths(agents, world)` (line 93-120):
  - 압력이 `PRESSURE_DEATH_THRESHOLD(3.5)`를 넘으면 `highPressureTicks` 누적, 미만이면 `PRESSURE_RECOVERY_RATE(3배 속도)`로 감소
  - `PRESSURE_DEATH_SECONDS(3초, 180틱)` 이상 지속되면 `agent.state = "dead"`로 전환하고 속도 0
- 렌더링(`draw.ts:143-204`, `drawAgents`): 사망 에이전트는 어두운 채우기(`#291b1d`) + 빨간 테두리/X 표시, 속도 화살표·라벨 없음

### 4.2 배속 기능 ("배속기능")

두 가지 독립적인 속도 제어가 존재:
- `agentSpeed`: 개별 에이전트의 목표 보행 속도(px/s), 기본값 `AGENT_MAX_SPEED = 25`
- `playbackRate`: 시뮬레이션 시간 배율(0.25×~4×, `ControlPanel.tsx:63-74`)

`playbackRate`는 `TopViewCanvas.tsx:334`에서 적용: `acc += delta * playbackRate` — 실제 프레임당 시뮬레이션 시계에 주입되는 시간량을 조절하는 방식으로, 개별 에이전트 속도가 아니라 전체 시뮬레이션 클록 자체를 가속/감속시킴.

### 4.3 에이전트 스폰

- `spawnAgent(id, deps)` (`agents.ts:215-276`): 무작위 리프 노드 시작/목표 쌍 선택(`pickRandomEndpointPair`, line 149-165) → Dijkstra 경로 탐색 → 스폰 위치를 첫 차선을 따라 약간 분산(`SPAWN_FORWARD_SPREAD_PX`, `SPAWN_LATERAL_JITTER_PX`, line 209-260, 밀집 스폰 방지) → `AGENT_SPEED_VARIANCE_MIN~MAX(0.82~1.18)` 범위의 랜덤 `speedFactor` 부여
- `continueArrivedAgents` (`agents.ts:521-576`): `"arrived"` 상태가 되면 사라지지 않고 현재 노드 기준 새 목적지를 배정(연속 흐름). 도달 가능한 목적지가 없을 때만 `spawnAgent`로 재스폰
- 배치 스폰: 초기 인구는 `pendingAddCountRef`를 통해 `ADD_AGENTS_BATCH_SIZE(5명)`씩 `ADD_AGENTS_BATCH_INTERVAL_MS(200ms)` 간격으로 드레인(`presets.ts:28-29`, `TopViewCanvas.tsx:306-331`) — 한 프레임에 전량 스폰 시 겹침 더미가 생기는 것을 방지

## 5. 주요 상수 (`src/simulation/presets.ts`)

| 상수 | 값 | 설명 |
|---|---|---|
| `AGENT_RADIUS` | 4px | 에이전트 반지름 |
| `AGENT_MAX_SPEED` | 25 px/s | 기본 목표 속도 |
| `ARRIVAL_RADIUS` | 10px | 웨이포인트 도착 판정 반경 |
| `AGENT_LANE_OFFSET` | 5px | 우측통행 차선 오프셋 |
| `SFM_TAU` | 0.5s | 구동력 완화시간 |
| `SFM_A_AGENT` / `SFM_B_AGENT` | 300 / 4 | 에이전트 간 반발 강도/범위 |
| `SFM_A_WALL` / `SFM_B_WALL` | 500 / 4 | 벽 반발 강도/범위 |
| `SFM_K_BODY` / `SFM_KAPPA` | 700 / 30 | 몸체 접촉 스프링/마찰 |
| `SFM_SPEED_FACTOR` | 1.3 | 목표속도 대비 최대속도 배율 |
| `SFM_ANISOTROPY_LAMBDA` | 0.5 | 후방 인지 감쇠 비율 |
| `AGENT_SPEED_VARIANCE_MIN/MAX` | 0.82 / 1.18 | 개인별 속도 편차 범위 |
| `STUCK_SPEED_FRACTION` | 0.3 | "정체" 판정 기준(목표속도 대비) |
| `STUCK_PATIENCE_TICKS` | 90 (1.5s) | 임패이션스 시작 전 인내 시간 |
| `STUCK_RAMP_TICKS` | 120 (2s) | 최대 부스트까지 도달 시간 |
| `STUCK_BOOST_MAX` | 1 | 최대 속도 부스트(+100%) |
| `STUCK_JITTER_MAX_RAD` | π/8 (22.5°) | 최대 방향 지터 |
| `PRESSURE_CONTACT_RANGE_PX` | 3px | 압축 시작 거리 |
| `PRESSURE_DEATH_THRESHOLD` | 3.5 | 사망 유발 압력 임계값 |
| `PRESSURE_DEATH_SECONDS` | 3s | 임계값 초과 지속 시 사망까지 걸리는 시간 |
| `PRESSURE_RECOVERY_RATE` | 3 | 압력 회복 속도(축적 대비 배수) |

## 6. 참고용 테스트 파일

- `src/simulation/agents.test.ts`
- `src/simulation/socialForce.test.ts`
- `src/simulation/pressure.test.ts`
- `src/simulation/corridors.test.ts`
- `src/simulation/density.test.ts`
- `src/simulation/graph.test.ts`

각 시스템의 기대 동작 예시가 실행 가능한 형태로 담겨 있어, 새 시뮬레이션 설계 시 레퍼런스로 활용 가능.
