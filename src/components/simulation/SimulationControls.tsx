import type { ArrivalMetrics } from "../../simulation/metrics";
import type { ScenarioMode } from "../../simulation/engine";

const PLAYBACK_RATES = [0.25, 0.5, 1, 2, 4];

const SCENARIO_MODE_OPTIONS: { mode: ScenarioMode; label: string }[] = [
  { mode: "evacuation", label: "대피 모드" },
  { mode: "arrival", label: "입장 모드" },
  { mode: "free", label: "자유 이동" },
];

export interface SimulationCounts {
  total: number;
  moving: number;
  arrived: number;
  dead: number;
  pendingSpawn: number;
}

export interface SimulationControlsProps {
  playing: boolean;
  onTogglePlaying: () => void;
  playbackRate: number;
  onChangePlaybackRate: (rate: number) => void;
  population: number;
  onChangePopulation: (population: number) => void;
  /** Rushing/panic level in [0, 1]; 0 = calm walking. */
  urgency: number;
  onChangeUrgency: (urgency: number) => void;
  onReset: () => void;
  counts: SimulationCounts;
  metrics: ArrivalMetrics;
  bottleneckCount: number;
  elapsedSeconds: number;
  /** Current scenario mode. Only rendered when onChangeScenarioMode is given. */
  scenarioMode?: ScenarioMode;
  onChangeScenarioMode?: (mode: ScenarioMode) => void;
  /** Runs the rest of the simulation to its settled end with no rendering.
   * Only rendered when provided - some call sites may not offer a skip. */
  onSkipAhead?: () => void;
  /** True while a skip-ahead call is blocking the main thread. Disables
   * every other control so the freeze reads as intentional. */
  skipping?: boolean;
  /** 0 to 1 across the skip budget; shown as a percentage while skipping. */
  skipProgress?: number;
  /** Stops a running skip. Rendered as a cancel button while skipping. */
  onCancelSkip?: () => void;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function SimulationControls({
  playing,
  onTogglePlaying,
  playbackRate,
  onChangePlaybackRate,
  population,
  onChangePopulation,
  urgency,
  onChangeUrgency,
  onReset,
  counts,
  metrics,
  bottleneckCount,
  elapsedSeconds,
  scenarioMode,
  onChangeScenarioMode,
  onSkipAhead,
  skipping = false,
  skipProgress = 0,
  onCancelSkip,
}: SimulationControlsProps) {
  return (
    <div className="sim-toolbar">
      {onChangeScenarioMode && (
        <div className="sim-field" role="group" aria-label="시나리오 모드">
          {SCENARIO_MODE_OPTIONS.map((option) => (
            <button
              key={option.mode}
              type="button"
              className="toggle-button"
              aria-pressed={scenarioMode === option.mode}
              disabled={skipping}
              onClick={() => onChangeScenarioMode(option.mode)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
      <label className="sim-field">
        <span>인원</span>
        <input
          type="number"
          min={1}
          max={2000}
          value={population}
          disabled={skipping}
          onChange={(e) => onChangePopulation(Math.max(1, Number(e.target.value)))}
        />
      </label>
      <label className="sim-field" title="0%는 평상시 보행(밀지 않음), 높을수록 서두르며 막혀도 계속 밀어붙여 병목에 압력이 쌓입니다">
        <span>긴급도 {Math.round(urgency * 100)}%</span>
        <input
          type="range"
          min={0}
          max={100}
          step={10}
          value={Math.round(urgency * 100)}
          disabled={skipping}
          onChange={(e) => onChangeUrgency(Number(e.target.value) / 100)}
        />
      </label>
      <button type="button" className="toggle-button" disabled={skipping} onClick={onTogglePlaying}>
        {playing ? "일시정지" : "재생"}
      </button>
      <label className="sim-field">
        <span>배속</span>
        <select
          value={playbackRate}
          disabled={skipping}
          onChange={(e) => onChangePlaybackRate(Number(e.target.value))}
        >
          {PLAYBACK_RATES.map((rate) => (
            <option key={rate} value={rate}>
              {rate}x
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="toggle-button" disabled={skipping} onClick={onReset}>
        초기화
      </button>
      {onSkipAhead && (
        <span className="sim-field" title="화면에 그리지 않고 나머지 구간을 계산만 해서, 끝까지 1배속으로 재생했을 때와 동일한 결과로 건너뜁니다">
          <button type="button" className="toggle-button" disabled={skipping} onClick={onSkipAhead}>
            {skipping ? `건너뛰는 중 ${Math.round(skipProgress * 100)}%` : "결과까지 건너뛰기"}
          </button>
          {/* A skip runs for minutes of wall clock at the demo population,
              so it has to be stoppable: the comparison is usually obvious
              long before the run settles, and the numbers reached so far
              are real either way. */}
          {skipping && onCancelSkip && (
            <button type="button" className="toggle-button" onClick={onCancelSkip}>
              여기서 멈추기
            </button>
          )}
        </span>
      )}
      <span className="sim-status">
        경과 {formatElapsed(elapsedSeconds)} · 이동 {counts.moving} · 도착 {counts.arrived}(
        {metrics.arrivalRatePercent.toFixed(0)}%) · 95% 대피시간{" "}
        {metrics.evacuationP95Seconds !== null ? `${metrics.evacuationP95Seconds.toFixed(1)}s` : "측정 중"} · 평균 도착 시간{" "}
        {metrics.meanTravelSeconds !== null ? `${metrics.meanTravelSeconds.toFixed(1)}s` : "측정 중"} · 병목{" "}
        {bottleneckCount} · 고압력 위험 노출 {metrics.highPressureExposed} · 대기 {counts.pendingSpawn}
      </span>
    </div>
  );
}
