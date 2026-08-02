const PLAYBACK_RATES = [0.25, 0.5, 1, 2, 4];

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
  onReset: () => void;
  counts: SimulationCounts;
  elapsedSeconds: number;
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
  onReset,
  counts,
  elapsedSeconds,
}: SimulationControlsProps) {
  return (
    <div className="sim-toolbar">
      <label className="sim-field">
        <span>인원</span>
        <input
          type="number"
          min={1}
          max={2000}
          value={population}
          onChange={(e) => onChangePopulation(Math.max(1, Number(e.target.value)))}
        />
      </label>
      <button type="button" className="toggle-button" onClick={onTogglePlaying}>
        {playing ? "일시정지" : "재생"}
      </button>
      <label className="sim-field">
        <span>배속</span>
        <select value={playbackRate} onChange={(e) => onChangePlaybackRate(Number(e.target.value))}>
          {PLAYBACK_RATES.map((rate) => (
            <option key={rate} value={rate}>
              {rate}x
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="toggle-button" onClick={onReset}>
        초기화
      </button>
      <span className="sim-status">
        경과 {formatElapsed(elapsedSeconds)} · 이동 {counts.moving} · 도착 {counts.arrived} · 위험 노출{" "}
        {counts.dead} · 대기 {counts.pendingSpawn}
      </span>
    </div>
  );
}
