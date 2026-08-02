import { useEffect, useState } from "react";
import type { VenueSimulation } from "./engine";

export interface AgentPovSelection {
  agentId: string | null;
  /** Starts following a random currently-moving agent, if any exist. */
  start: () => void;
  /** Switches to a different random moving agent (excluding the current one
   * when possible), without leaving POV mode. */
  next: () => void;
  /** Returns to the overview camera. */
  stop: () => void;
}

function pickRandomMovingAgentId(simulation: VenueSimulation, excludeId?: string | null): string | null {
  const candidates = simulation.agents.filter((a) => a.state === "moving" && a.id !== excludeId);
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)].id;
}

/**
 * Tracks which agent (if any) the 3D scene's camera should follow in
 * first-person ("에이전트 시점") mode. Reset to the overview whenever the
 * simulation instance itself changes (population edit or explicit reset
 * creates a new VenueSimulation - see useVenueSimulation), since agent ids
 * from the previous instance no longer exist.
 */
export function useAgentPovSelection(simulation: VenueSimulation): AgentPovSelection {
  const [agentId, setAgentId] = useState<string | null>(null);

  useEffect(() => {
    setAgentId(null);
  }, [simulation]);

  return {
    agentId,
    start: () => setAgentId((current) => current ?? pickRandomMovingAgentId(simulation)),
    next: () => setAgentId((current) => pickRandomMovingAgentId(simulation, current) ?? current),
    stop: () => setAgentId(null),
  };
}
