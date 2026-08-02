import { useEffect, useState } from "react";
import type { Venue } from "../../domain/types";
import { useVenueSimulation } from "../../simulation/useVenueSimulation";
import { useAgentPovSelection } from "../../simulation/useAgentPovSelection";
import { VenueScene } from "../../three/VenueScene";
import { Agents } from "../../three/Agents";
import { DensityHeatmap } from "../../three/DensityHeatmap";
import { AgentPovCamera } from "../../three/AgentPovCamera";
import { FreeCamera } from "../../three/FreeCamera";
import { SimulationControls } from "./SimulationControls";
import { ScenarioInput } from "./ScenarioInput";
import { CameraModeToolbar, type CameraMode } from "./CameraModeToolbar";
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
  const [cameraMode, setCameraMode] = useState<CameraMode>("overview");

  // A new VenueSimulation instance (population change or explicit reset)
  // invalidates any followed agent id, and free-fly position/orbit state
  // don't carry meaning across runs either - drop back to the overview.
  useEffect(() => {
    setCameraMode("overview");
  }, [simulation]);

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
      <CameraModeToolbar
        mode={cameraMode}
        onSelectOverview={() => {
          pov.stop();
          setCameraMode("overview");
        }}
        onSelectPov={() => {
          pov.start();
          setCameraMode("pov");
        }}
        onSelectFree={() => {
          pov.stop();
          setCameraMode("free");
        }}
        onNextAgent={pov.next}
      />
      <VenueScene venue={venue} disableOrbitControls={cameraMode !== "overview"} fov={cameraMode === "overview" ? 50 : 75}>
        <DensityHeatmap simulation={simulation} />
        <Agents simulation={simulation} capacity={population} />
        {cameraMode === "pov" && pov.agentId && <AgentPovCamera simulation={simulation} agentId={pov.agentId} />}
        {cameraMode === "free" && <FreeCamera />}
      </VenueScene>
    </div>
  );
}
