import type { VenueSimulation } from "../../simulation/engine";

export interface ComparisonMetricsTableProps {
  baseline: VenueSimulation;
  robbins: VenueSimulation;
  optimized: VenueSimulation;
}

function formatSeconds(value: number | null): string {
  return value === null ? "측정 중" : `${value.toFixed(1)}s`;
}

function deltaLabel(base: number, opt: number, lowerIsBetter: boolean): string {
  const diff = opt - base;
  if (Math.abs(diff) < 1e-9) return "±0";
  const better = lowerIsBetter ? diff < 0 : diff > 0;
  const sign = diff > 0 ? "+" : "";
  return `${sign}${diff.toFixed(1)} ${better ? "(개선)" : "(악화)"}`;
}

function secondsDelta(base: number | null, opt: number | null): string {
  return base !== null && opt !== null ? deltaLabel(base, opt, true) : "측정 중";
}

/** Side-by-side readout of the plan's headline comparison metrics (FR-08)
 * across all three orientations, assuming all three simulations were
 * constructed with the same seed/population (usePairedVenueSimulation
 * enforces the shared clock; matching options is the caller's
 * responsibility - see ComparisonView). The 변화 column compares MR2S
 * against 기준안 specifically - Robbins is shown for context (the fair
 * one-way baseline) but isn't itself the thing MR2S is scored against. */
export function ComparisonMetricsTable({ baseline, robbins, optimized }: ComparisonMetricsTableProps) {
  const baseMetrics = baseline.metrics();
  const robbinsMetrics = robbins.metrics();
  const optMetrics = optimized.metrics();
  const baseDead = baseline.counts().dead;
  const robbinsDead = robbins.counts().dead;
  const optDead = optimized.counts().dead;

  const rows = [
    {
      label: "도착률",
      base: `${baseMetrics.arrivalRatePercent.toFixed(0)}%`,
      robbins: `${robbinsMetrics.arrivalRatePercent.toFixed(0)}%`,
      opt: `${optMetrics.arrivalRatePercent.toFixed(0)}%`,
      delta: deltaLabel(baseMetrics.arrivalRatePercent, optMetrics.arrivalRatePercent, false),
    },
    {
      label: "사망",
      base: `${baseDead}명`,
      robbins: `${robbinsDead}명`,
      opt: `${optDead}명`,
      delta: deltaLabel(baseDead, optDead, true),
    },
    {
      label: "95% 대피시간",
      base: formatSeconds(baseMetrics.evacuationP95Seconds),
      robbins: formatSeconds(robbinsMetrics.evacuationP95Seconds),
      opt: formatSeconds(optMetrics.evacuationP95Seconds),
      delta: secondsDelta(baseMetrics.evacuationP95Seconds, optMetrics.evacuationP95Seconds),
    },
    {
      label: "평균 도착 시간",
      base: formatSeconds(baseMetrics.meanTravelSeconds),
      robbins: formatSeconds(robbinsMetrics.meanTravelSeconds),
      opt: formatSeconds(optMetrics.meanTravelSeconds),
      delta: secondsDelta(baseMetrics.meanTravelSeconds, optMetrics.meanTravelSeconds),
    },
    {
      label: "병목 구간 수",
      base: `${baseline.bottleneckCorridorIds.size}`,
      robbins: `${robbins.bottleneckCorridorIds.size}`,
      opt: `${optimized.bottleneckCorridorIds.size}`,
      delta: deltaLabel(baseline.bottleneckCorridorIds.size, optimized.bottleneckCorridorIds.size, true),
    },
    {
      label: "고압력 위험 노출",
      base: `${baseMetrics.highPressureExposed}명`,
      robbins: `${robbinsMetrics.highPressureExposed}명`,
      opt: `${optMetrics.highPressureExposed}명`,
      delta: deltaLabel(baseMetrics.highPressureExposed, optMetrics.highPressureExposed, true),
    },
  ];

  return (
    <table className="comparison-table">
      <thead>
        <tr>
          <th>지표</th>
          <th>기준안</th>
          <th>Robbins</th>
          <th>MR2S</th>
          <th>변화 (MR2S vs 기준안)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <td>{row.label}</td>
            <td>{row.base}</td>
            <td>{row.robbins}</td>
            <td>{row.opt}</td>
            <td>{row.delta}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
