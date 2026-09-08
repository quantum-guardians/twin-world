import type { VenueSimulation } from "../../simulation/engine";

export interface ComparisonMetricsTableProps {
  baseline: VenueSimulation;
  robbins: VenueSimulation;
  optimized: VenueSimulation;
  /** APSP sum over every ordered node pair for each orientation, in meters;
   * null when that orientation is not strongly connected. Passed in rather
   * than computed here because it depends only on the venue geometry, not
   * on how far the run has got. */
  routeLengthBaseline: number | null;
  routeLengthRobbins: number | null;
  routeLengthOptimized: number | null;
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

function formatRouteLength(sum: number | null): string {
  // null means the orientation isn't strongly connected (a bridge edge
  // pointed the wrong way cuts one side off from the other) - render that
  // as "연결 불가" rather than a number, since 0 would read as "no distance
  // at all" instead of "unreachable".
  return sum === null ? "연결 불가" : `${Math.round(sum).toLocaleString("ko-KR")}m`;
}

function routeLengthDelta(base: number | null, opt: number | null): string {
  if (base === null || opt === null || base <= 0) return "연결 불가";
  const percent = ((opt - base) / base) * 100;
  // Longer routes are the price of one-way, not a defect - label the
  // direction plainly and let the Robbins column carry the comparison
  // that matters.
  return `${percent > 0 ? "+" : ""}${percent.toFixed(1)}%`;
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
export function ComparisonMetricsTable({
  baseline,
  robbins,
  optimized,
  routeLengthBaseline,
  routeLengthRobbins,
  routeLengthOptimized,
}: ComparisonMetricsTableProps) {
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
    {
      // Not a simulation result: the APSP sum is a property of the graph
      // and its directions, fixed before anyone walks anywhere. It sits in
      // the same table because it is the reason the rows above come out the
      // way they do - one-way always lengthens routes, and the question is
      // whether it buys back more than it costs.
      label: "경로 길이 합 (APSP)",
      base: formatRouteLength(routeLengthBaseline),
      robbins: formatRouteLength(routeLengthRobbins),
      opt: formatRouteLength(routeLengthOptimized),
      delta: routeLengthDelta(routeLengthBaseline, routeLengthOptimized),
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
