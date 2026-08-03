# 2026-08-03 — Moussaïd 비전 휴리스틱 모델로 사회적 반발 교체 (접촉 물리 유지)

- Date: 2026-08-03
- GitHub Issue: #13
- Status: Draft

## Goal

에이전트 회피 행동을 거리 기반 지수 반발력(Helbing SFM 심리력)에서
**Moussaïd–Helbing–Theraulaz (2011, PNAS) 비전 기반 휴리스틱**으로 교체한다:

1. 시야각(±φ) 내 후보 방향 α마다 충돌까지 걸을 수 있는 거리 f(α)를 계산
   (이웃 에이전트는 등속 외삽, 벽은 정적 세그먼트).
2. 비용 d(α) = √(dmax² + f(α)² − 2·dmax·f(α)·cos(α0−α)) 를 최소화하는
   방향 선택 (α0 = 현재 웨이포인트 방향).
3. 희망 속력 v = min(v0, f(α*)/τ) — 충돌 전에 멈출 수 있는 속도.
4. **Helbing 접촉 물리(몸체 스프링 SFM_K_BODY + 미끄럼 마찰 SFM_KAPPA,
   Nature 2000)는 유지** — 압사 압력 지표(pressure.ts)의 물리적 근원.
5. 반물리 보정 제거: `minForwardSpeed` 강제 전진, STUCK 부스트/지터,
   `socialScale`, 차선 구속(`constrainAgentsToRoutes`), 차선 오프셋 조향.

참고 논문:
- Moussaïd, Helbing & Theraulaz 2011, PNAS 108(17)
  https://www.pnas.org/doi/10.1073/pnas.1016507108 (본문 Eq. 1–3 + SI)
- Helbing, Farkas & Vicsek 2000, Nature 407 (접촉력)
  https://arxiv.org/abs/cond-mat/0009448

## Non-goals

- 경로탐색(Dijkstra) / 웨이포인트 / 스폰 / 도착 판정 변경 없음.
- pressure.ts 사망 모델 공식 변경 없음 (임계값 재보정은 후속 관찰 후).
- 렌더링(three/) 변경 없음. DesiredMotion 계약 축소 외 API 형태 유지.
- 자연어 시나리오 확장(별도 논의)은 이 이슈 범위 밖.

## Context / Constraints

- 현재 파이프라인 (engine.ts tick):
  `computeDesiredDirections → stepSocialForce → constrainAgentsToRoutes →
  enforceContainment → updatePressureDeaths`
- 60 Hz 고정 스텝 + 서브스텝(이동량 0.15 m 상한). 결정은 매 틱 비싸므로
  **비전 방향 결정은 6틱(10 Hz) 캐시** — 인간 반응시간과도 정합.
- 성능: 후보 방향 ~21개(±75°, 7.5° 간격) × 시야 내 이웃. 이웃은
  horizon(dmax=8 m) 내 거리 필터 + 최근접 K(≈12)로 제한. 기존 O(N²)
  반발력 계산이 사라지므로 총비용은 비슷하거나 감소.
- 지터 제거로 조향이 **결정론적**이 됨 → 기준안 vs 최적화안 비교의
  재현성 개선 (mulberry32 시드는 스폰에만 사용).
- 데드락 대칭 깨기: 비용 동률 시 우측 선호(작은 ε 우측 바이어스) —
  우측통행 관습 반영, 제거되는 rightLaneTarget의 역할 흡수.

## Approach (Checklist)

- [ ] **Step 0: Recon** — 완료. socialForce.ts / agents.ts / engine.ts /
      simPresets.ts / 기존 테스트 구조 파악 (위 Context 참조).
- [ ] **Step 1: Implementation**
  - [ ] `src/simulation/visionHeuristic.ts` 신설 (순수 함수):
        `collisionDistanceToAgent`(등속 외삽 2차방정식),
        `collisionDistanceToWall`(레이–세그먼트),
        `chooseHeuristicMotion(agent, α0, neighbors, walls, params)` →
        `{ex, ey, speed}`.
  - [ ] `src/domain/simPresets.ts`: `VISION_PHI_RAD`(75°),
        `VISION_HORIZON_M`(8), `VISION_RAY_COUNT`(21),
        `VISION_DECISION_INTERVAL_TICKS`(6), `VISION_NEIGHBOR_MAX`(12),
        `VISION_RIGHT_BIAS` 추가. `STUCK_*`, `SFM_A_*`, `SFM_B_*`,
        `SFM_ANISOTROPY_LAMBDA`, `SFM_CUTOFF_FACTOR`,
        `AGENT_LANE_OFFSET` 등 미사용화되는 상수 제거.
  - [ ] `agents.ts` `computeDesiredDirections`: 웨이포인트 진행/도착
        로직은 유지, 조향만 비전 휴리스틱 호출로 교체. stuck/지터/차선
        오프셋 삭제. `constrainAgentsToRoutes` 삭제.
  - [ ] `socialForce.ts` `stepSocialForce`: 지수 사회 반발(에이전트·벽)
        + 이방성 + socialScale + minForwardSpeed 플로어 제거. 접촉
        스프링/마찰, 적분기, 서브스텝, 겹침 해소, 벽 통과 방지 유지.
        속도 상한은 희망속력 기준 1.3×에서 **절대 안전 상한(5 m/s)**으로
        교체 — 군중 난류(밀려남)가 표현되도록.
  - [ ] `engine.ts` tick 순서 갱신 (constrainAgentsToRoutes 제거,
        enforceContainment는 하드 백스톱으로 유지).
- [ ] **Step 2: Tests**
  - [ ] `visionHeuristic.test.ts` 신설: 정면 접근 TTC, 정지 장애물,
        비껴가는 경로(충돌 없음 → f=dmax), 벽 레이 교차, 직진 차단 시
        측면 방향 선택, 장애물 근접 시 감속(v=f/τ), 우측 바이어스.
  - [ ] `agents.test.ts` / `engine.test.ts` 기존 케이스를 새 계약
        (DesiredMotion에서 minForwardSpeed/socialScale 제거)에 맞게 갱신.
  - [ ] 수동 검증: `npm run dev` — 대향류 차선 창발, 병목 정체 발생,
        고밀도에서 압력 축적/사망 판정, 프레임률(150~500명) 확인.
- [ ] **Step 3: Rollout / Rollback**
  - [ ] 플래그 없음(전면 교체). 롤백은 PR revert 한 번으로 가능하도록
        커밋을 이슈 단위로 응집.

## Validation

- **Commands to run:** `npm run test`, `npm run build`
- **Expected output:** 전체 테스트 green, 타입 에러 없음. 수동으로
  150명 기본 시나리오에서 이전 대비 자연스러운 회피(진동 없음),
  병목에서 물리적 정체 확인.

## Risks & Rollback

- **Risks:**
  - 강제 전진 제거로 병목 데드락 가능 → 비전 회피의 예측성 + 우측
    바이어스로 완화, 잔존 시 후속 튜닝(φ, dmax).
  - 압력 지표 스케일 변화 → PRESSURE_DEATH_THRESHOLD 재보정 필요할 수
    있음(관찰 후 별도 커밋).
  - 차선 구속 제거로 교차로에서 경로 이탈 → enforceContainment 백스톱
    + 벽이 시야에 잡히므로 통제됨. 수동 검증 항목에 포함.
  - 기준안/최적화안 비교 수치가 기존 데모와 달라짐 (발표 자료 갱신 필요).
- **Rollback steps:** PR 단위 `git revert`.

## Open Questions

- (없음 — 사용자와 모델 선택(Moussaïd ②) 및 hack 제거 방침 합의됨)
