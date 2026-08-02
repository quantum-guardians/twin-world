import type { VenueSimulation } from "../../simulation/engine";

export interface ComparisonMetricsTableProps {
  baseline: VenueSimulation;
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

/** Side-by-side readout of the plan's headline comparison metrics (FR-08),
 * assuming both simulations were constructed with the same seed/population
 * (usePairedVenueSimulation enforces the shared clock; matching options is
 * the caller's responsibility - see ComparisonView). */
export function ComparisonMetricsTable({ baseline, optimized }: ComparisonMetricsTableProps) {
  const baseMetrics = baseline.metrics();
  const optMetrics = optimized.metrics();

  const rows = [
    {
      label: "도착률",
      base: `${baseMetrics.arrivalRatePercent.toFixed(0)}%`,
      opt: `${optMetrics.arrivalRatePercent.toFixed(0)}%`,
      delta: deltaLabel(baseMetrics.arrivalRatePercent, optMetrics.arrivalRatePercent, false),
    },
    {
      label: "95% 대피시간",
      base: formatSeconds(baseMetrics.evacuationP95Seconds),
      opt: formatSeconds(optMetrics.evacuationP95Seconds),
      delta:
        baseMetrics.evacuationP95Seconds !== null && optMetrics.evacuationP95Seconds !== null
          ? deltaLabel(baseMetrics.evacuationP95Seconds, optMetrics.evacuationP95Seconds, true)
          : "측정 중",
    },
    {
      label: "병목 구간 수",
      base: `${baseline.bottleneckCorridorIds.size}`,
      opt: `${optimized.bottleneckCorridorIds.size}`,
      delta: deltaLabel(baseline.bottleneckCorridorIds.size, optimized.bottleneckCorridorIds.size, true),
    },
    {
      label: "고압력 위험 노출",
      base: `${baseMetrics.highPressureExposed}명`,
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
          <th>최적화안</th>
          <th>변화</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <td>{row.label}</td>
            <td>{row.base}</td>
            <td>{row.opt}</td>
            <td>{row.delta}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
