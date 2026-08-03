import type { SimulationCounts } from "../components/simulation/SimulationControls";

/**
 * Turns the running simulation's numbers into operator-facing warnings. The
 * status line already shows every count, but a run is watched in 3D, not
 * read digit by digit - a crush builds while nobody is looking at the text.
 * Ratios, not absolute counts, so the thresholds hold for 150 agents and for
 * 3,000.
 */

/** Fraction of spawned agents crushed before the run counts as a casualty
 * event rather than the odd unlucky agent. */
export const DEAD_ALERT_RATIO = 0.02;
/** Fraction ever pushed past the pressure threshold - survivable, but this
 * many means the crowd is being squeezed venue-wide. */
export const HIGH_PRESSURE_ALERT_RATIO = 0.15;
/** Corridors jammed at once. One is a queue; several at once is a venue
 * that has stopped draining. */
export const BOTTLENECK_ALERT_COUNT = 3;

export function simulationAlerts(
  counts: SimulationCounts,
  highPressureExposed: number,
  bottleneckCount: number
): string[] {
  const alerts: string[] = [];
  const spawned = counts.total;
  if (spawned > 0 && counts.dead / spawned >= DEAD_ALERT_RATIO) {
    alerts.push(`압사 위험: ${counts.dead}명 사망 (${((counts.dead / spawned) * 100).toFixed(1)}%)`);
  }
  if (spawned > 0 && highPressureExposed / spawned >= HIGH_PRESSURE_ALERT_RATIO) {
    alerts.push(
      `고압력 노출 ${highPressureExposed}명 (${((highPressureExposed / spawned) * 100).toFixed(0)}%) - 군중 압력 위험`
    );
  }
  if (bottleneckCount >= BOTTLENECK_ALERT_COUNT) {
    alerts.push(`병목 ${bottleneckCount}곳 동시 발생 - 동선이 막혔습니다`);
  }
  return alerts;
}
