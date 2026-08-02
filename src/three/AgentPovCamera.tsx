import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { VenueSimulation } from "../simulation/engine";
import { AGENT_EYE_HEIGHT_ADULT, AGENT_EYE_HEIGHT_CHILD } from "../domain/simPresets";

export interface AgentPovCameraProps {
  simulation: VenueSimulation;
  agentId: string;
}

/**
 * "에이전트 시점" mode: pins the scene's active camera to one agent's eye
 * position and facing direction every frame, so the user can experience
 * the crowd from inside it rather than only from the overview. Renders
 * nothing itself - VenueScene must be told to skip its own OrbitControls
 * (disableOrbitControls) while this is mounted, since both would otherwise
 * fight over the same camera each frame.
 *
 * Facing direction comes from the agent's current SFM velocity, not its
 * route direction - Social Force velocity is what the agent is actually
 * doing this instant (sidestepping, facing into a crowd, momentarily
 * stationary under pressure), which is the more honest "what would this
 * person see" answer. It's lerped rather than snapped because raw
 * per-tick velocity direction is jittery (agent-agent repulsion changes
 * it substantially tick to tick), which would otherwise read as a shaky
 * camera instead of a walking person.
 */
export function AgentPovCamera({ simulation, agentId }: AgentPovCameraProps) {
  const { camera } = useThree();
  const lookDir = useRef(new THREE.Vector3(0, 0, -1));
  const lookAtScratch = useRef(new THREE.Vector3());

  useFrame(() => {
    const body = simulation.world.agents.get(agentId);
    const agent = simulation.agents.find((a) => a.id === agentId);
    if (!body || !agent) return;

    const eyeHeight = agent.ageGroup === "child" ? AGENT_EYE_HEIGHT_CHILD : AGENT_EYE_HEIGHT_ADULT;
    camera.position.set(body.position.x, eyeHeight, body.position.y);

    const speed = Math.hypot(body.velocity.x, body.velocity.y);
    if (speed > 0.05) {
      const targetDir = new THREE.Vector3(body.velocity.x, 0, body.velocity.y).normalize();
      lookDir.current.lerp(targetDir, 0.15);
      if (lookDir.current.lengthSq() > 1e-9) lookDir.current.normalize();
    }

    lookAtScratch.current.copy(camera.position).add(lookDir.current);
    camera.lookAt(lookAtScratch.current);
  });

  return null;
}
