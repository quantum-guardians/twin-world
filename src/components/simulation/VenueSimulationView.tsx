import { useState } from "react";
import type { Venue } from "../../domain/types";
import { useVenueSimulation } from "../../simulation/useVenueSimulation";
import { useAgentPovSelection } from "../../simulation/useAgentPovSelection";
import { VenueScene } from "../../three/VenueScene";
import { Agents } from "../../three/Agents";
import { DensityHeatmap } from "../../three/DensityHeatmap";
import { AgentPovCamera } from "../../three/AgentPovCamera";
import { SimulationControls } from "./SimulationControls";
import { ScenarioInput } from "./ScenarioInput";
import { PovToolbar } from "./PovToolbar";
import { DEFAULT_AGENT_COUNT } from "../../domain/simPresets";

export interface VenueSimulationViewProps {
  venue: Venue;
}

export function VenueSimulationView({ venue }: VenueSimulationViewProps) {
  const [population, setPopulation] = useState(DEFAULT_AGENT_COUNT);
  // Fixed for now (task 5/6 scope). Baseline vs. MR2S-optimized comparison
  // runs (task 8) must share this same seed so both start from identical
  // spawn/destination assignments - see plan FR-09.
  const [seed] = useState(1);

  const { simulation, controls } = useVenueSimulation(venue, { population, seed });
  const pov = useAgentPovSelection(simulation);

  return (
    <div className="sim-view">
      <ScenarioInput defaultPopulation={population} onApplyPopulation={setPopulation} />
      <SimulationControls
        playing={controls.playing}
        onTogglePlaying={() => controls.setPlaying(!controls.playing)}
        playbackRate={controls.playbackRate}
        onChangePlaybackRate={controls.setPlaybackRate}
        population={population}
        onChangePopulation={setPopulation}
        onReset={controls.reset}
        counts={simulation.counts()}
        metrics={simulation.metrics()}
        bottleneckCount={simulation.bottleneckCorridorIds.size}
        elapsedSeconds={simulation.elapsedSeconds}
      />
      <PovToolbar pov={pov} />
      <VenueScene venue={venue} disableOrbitControls={!!pov.agentId} fov={pov.agentId ? 75 : 50}>
        <DensityHeatmap simulation={simulation} />
        <Agents simulation={simulation} capacity={population} />
        {pov.agentId && <AgentPovCamera simulation={simulation} agentId={pov.agentId} />}
      </VenueScene>
    </div>
  );
}
