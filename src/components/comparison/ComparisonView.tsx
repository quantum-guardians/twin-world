import { useState } from "react";
import type { Venue } from "../../domain/types";
import { usePairedVenueSimulation } from "../../simulation/usePairedVenueSimulation";
import { VenueScene } from "../../three/VenueScene";
import { Agents } from "../../three/Agents";
import { DensityHeatmap } from "../../three/DensityHeatmap";
import { SimulationControls } from "../simulation/SimulationControls";
import { ComparisonMetricsTable } from "./ComparisonMetricsTable";
import { ReportPanel } from "./ReportPanel";
import { DEFAULT_AGENT_COUNT } from "../../domain/simPresets";

export interface ComparisonViewProps {
  baselineVenue: Venue;
  optimizedVenue: Venue;
}

type Selected = "baseline" | "optimized";

/**
 * Runs the baseline (pre-MR2S direction) and MR2S-optimized venues side by
 * side under identical population/seed (plan FR-09), showing one 3D scene
 * at a time (toggle) plus an always-visible metrics comparison table -
 * running two full WebGL scenes at once is unnecessary GPU cost for a
 * number that's cheap to compute from both engines regardless of which
 * one is currently rendered.
 */
export function ComparisonView({ baselineVenue, optimizedVenue }: ComparisonViewProps) {
  const [population, setPopulation] = useState(DEFAULT_AGENT_COUNT);
  const [seed] = useState(1);
  const [urgency, setUrgency] = useState(0);
  const [selected, setSelected] = useState<Selected>("baseline");

  const { baseline, optimized, controls } = usePairedVenueSimulation(baselineVenue, optimizedVenue, {
    population,
    seed,
    urgency,
  });
  const activeSim = selected === "baseline" ? baseline : optimized;
  const activeVenue = selected === "baseline" ? baselineVenue : optimizedVenue;

  return (
    <div className="sim-view">
      <div className="compare-toolbar">
        <div className="compare-tabs">
          <button
            type="button"
            className={selected === "baseline" ? "toggle-button active" : "toggle-button"}
            onClick={() => setSelected("baseline")}
          >
            기준안 (양방향)
          </button>
          <button
            type="button"
            className={selected === "optimized" ? "toggle-button active" : "toggle-button"}
            onClick={() => setSelected("optimized")}
          >
            최적화안 (MR2S)
          </button>
        </div>
        <ComparisonMetricsTable baseline={baseline} optimized={optimized} />
      </div>
      <ReportPanel venue={baselineVenue} population={population} baseline={baseline} optimized={optimized} />
      <SimulationControls
        playing={controls.playing}
        onTogglePlaying={() => controls.setPlaying(!controls.playing)}
        playbackRate={controls.playbackRate}
        onChangePlaybackRate={controls.setPlaybackRate}
        population={population}
        onChangePopulation={setPopulation}
        urgency={urgency}
        onChangeUrgency={setUrgency}
        onReset={controls.reset}
        counts={activeSim.counts()}
        metrics={activeSim.metrics()}
        bottleneckCount={activeSim.bottleneckCorridorIds.size}
        elapsedSeconds={activeSim.elapsedSeconds}
      />
      <VenueScene venue={activeVenue}>
        <DensityHeatmap simulation={activeSim} />
        <Agents simulation={activeSim} capacity={population} />
      </VenueScene>
    </div>
  );
}
