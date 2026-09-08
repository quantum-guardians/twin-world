import { useMemo, useState } from "react";
import type { Venue } from "../../domain/types";
import { usePairedVenueSimulation } from "../../simulation/usePairedVenueSimulation";
import { directedApspSum, robbinsOrientation } from "../../domain/robbinsOrientation";
import { VenueScene } from "../../three/VenueScene";
import { Agents } from "../../three/Agents";
import { AgentMarkers } from "../../three/AgentMarkers";
import { DensityHeatmap } from "../../three/DensityHeatmap";
import { SimulationControls } from "../simulation/SimulationControls";
import { ComparisonMetricsTable } from "./ComparisonMetricsTable";
import { ReportPanel } from "./ReportPanel";
import { DEMO_SCENARIO_MODE, DEMO_SCENARIO_POPULATION, DEMO_SCENARIO_URGENCY } from "../../domain/simPresets";
import type { ScenarioMode } from "../../simulation/engine";

export interface ComparisonViewProps {
  baselineVenue: Venue;
  optimizedVenue: Venue;
}

function formatRouteLength(sum: number | null): string {
  // null means the orientation isn't strongly connected (a bridge edge
  // pointed the wrong way cuts one side off from the other) - render that
  // as "연결 불가" rather than a number, since 0 would read as "no
  // distance at all" instead of "unreachable".
  return sum === null ? "연결 불가" : `${sum.toFixed(0)}m`;
}

/**
 * Runs the baseline (all-bidirectional), Robbins (one-way, no
 * optimization) and MR2S-optimized venues on one shared clock (plan
 * FR-09) and renders all three 3D scenes at once, side by side, plus an
 * always-visible metrics comparison table below them.
 *
 * The Robbins orientation is the fair one-way baseline: Robbins' 1939
 * theorem says every bridgeless connected graph has a strongly connected
 * one-way orientation, and the constructive DFS proof yields one with no
 * optimization at all. Comparing MR2S against the all-bidirectional graph
 * alone would be comparing one-way against no-one-way, which one-way
 * always loses on raw distance - Robbins shows what "just make it one-way,
 * badly" costs, so MR2S's gain over it is the gain from *which* way
 * streets run, not from one-way-ness itself. It's computed here (not
 * threaded through App.tsx) since it depends only on the baseline venue
 * and the seed already used for this run.
 *
 * Three WebGL canvases at DEMO_SCENARIO_POPULATION agents each is genuinely
 * heavy on the GPU and the physics loop alike (see
 * usePairedVenueSimulation's doc comment), so the intended way to read this
 * screen is `controls.skipAhead` - jump straight to the settled end state -
 * rather than watching all three scenes finish live.
 *
 * Opens on the arrival scenario rather than evacuation, because that is
 * the flow MR2S's objective actually matches: MR2S minimizes the sum of
 * shortest paths over every node pair, which is what gates-to-plaza
 * traffic looks like. Evacuation is a many-to-few flow into the three
 * southern exits, and on the festival preset one-way there only pays the
 * detour without relieving anything - measured with
 * scripts/density-sweep.ts, which reports that case honestly rather than
 * hiding it. See DEMO_SCENARIO_POPULATION for the measured numbers.
 */
export function ComparisonView({ baselineVenue, optimizedVenue }: ComparisonViewProps) {
  const [population, setPopulation] = useState(DEMO_SCENARIO_POPULATION);
  const [seed] = useState(1);
  const [urgency, setUrgency] = useState(DEMO_SCENARIO_URGENCY);
  const [scenarioMode, setScenarioMode] = useState<ScenarioMode>(DEMO_SCENARIO_MODE);

  const robbinsVenue = useMemo(() => robbinsOrientation(baselineVenue, seed), [baselineVenue, seed]);

  const { baseline, robbins, optimized, controls } = usePairedVenueSimulation(
    baselineVenue,
    robbinsVenue,
    optimizedVenue,
    { population, seed, urgency, scenarioMode }
  );

  // Static graph-theoretic route-length measure (APSP sum over every
  // ordered node pair, honouring direction), distinct from the simulated
  // crowd metrics in ComparisonMetricsTable below. baselineVenue's edges
  // are "bidirectional", so directedApspSum on it already counts both
  // directions of every edge - i.e. it IS the undirected sum, with no
  // separate computation needed.
  const routeLengthBaseline = useMemo(() => directedApspSum(baselineVenue), [baselineVenue]);
  const routeLengthRobbins = useMemo(() => directedApspSum(robbinsVenue), [robbinsVenue]);
  const routeLengthOptimized = useMemo(() => directedApspSum(optimizedVenue), [optimizedVenue]);

  const mr2sVsRobbinsPercent =
    routeLengthRobbins !== null && routeLengthOptimized !== null && routeLengthRobbins > 0
      ? ((routeLengthRobbins - routeLengthOptimized) / routeLengthRobbins) * 100
      : null;

  return (
    <div className="sim-view">
      <div className="compare-toolbar">
        <div className="compare-route-lengths">
          <span className="compare-route-lengths-label">경로 길이 합 (APSP, 그래프 측정값)</span>
          <span>기준안(양방향) {formatRouteLength(routeLengthBaseline)}</span>
          <span>Robbins {formatRouteLength(routeLengthRobbins)}</span>
          <span>MR2S {formatRouteLength(routeLengthOptimized)}</span>
          {mr2sVsRobbinsPercent !== null && mr2sVsRobbinsPercent > 0 && (
            <span>MR2S가 Robbins보다 {mr2sVsRobbinsPercent.toFixed(1)}% 짧음</span>
          )}
        </div>
        <ComparisonMetricsTable baseline={baseline} robbins={robbins} optimized={optimized} />
      </div>
      <ReportPanel venue={baselineVenue} population={population} baseline={baseline} robbins={robbins} optimized={optimized} />
      <SimulationControls
        playing={controls.playing}
        onTogglePlaying={() => controls.setPlaying(!controls.playing)}
        playbackRate={controls.playbackRate}
        onChangePlaybackRate={controls.setPlaybackRate}
        population={population}
        scenarioMode={scenarioMode}
        onChangeScenarioMode={setScenarioMode}
        onChangePopulation={setPopulation}
        urgency={urgency}
        onChangeUrgency={setUrgency}
        onReset={controls.reset}
        onSkipAhead={controls.skipAhead}
        skipping={controls.skipping}
        skipProgress={controls.skipProgress}
        onCancelSkip={controls.cancelSkip}
        counts={baseline.counts()}
        metrics={baseline.metrics()}
        bottleneckCount={baseline.bottleneckCorridorIds.size}
        elapsedSeconds={baseline.elapsedSeconds}
      />
      <div className="compare-scenes">
        <div className="compare-scene-pane">
          <div className="compare-scene-label">기준안 (양방향)</div>
          <VenueScene venue={baselineVenue}>
            <DensityHeatmap simulation={baseline} />
            <Agents simulation={baseline} capacity={population} />
            <AgentMarkers simulation={baseline} capacity={population} />
          </VenueScene>
        </div>
        <div className="compare-scene-pane">
          <div className="compare-scene-label">Robbins (최적화 없는 일방통행)</div>
          <VenueScene venue={robbinsVenue}>
            <DensityHeatmap simulation={robbins} />
            <Agents simulation={robbins} capacity={population} />
            <AgentMarkers simulation={robbins} capacity={population} />
          </VenueScene>
        </div>
        <div className="compare-scene-pane">
          <div className="compare-scene-label">MR2S 최적화안</div>
          <VenueScene venue={optimizedVenue}>
            <DensityHeatmap simulation={optimized} />
            <Agents simulation={optimized} capacity={population} />
            <AgentMarkers simulation={optimized} capacity={population} />
          </VenueScene>
        </div>
      </div>
    </div>
  );
}
