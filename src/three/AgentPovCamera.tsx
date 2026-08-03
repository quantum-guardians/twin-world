import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { VenueSimulation } from "../simulation/engine";
import { AGENT_EYE_HEIGHT_RATIO, AGENT_RENDER_HEIGHT_M } from "../domain/simPresets";
import { useDragLook } from "./useDragLook";

export interface AgentPovCameraProps {
  simulation: VenueSimulation;
  agentId: string;
}

const UP = new THREE.Vector3(0, 1, 0);

/**
 * "에이전트 시점" mode: pins the scene's active camera to one agent's eye
 * position every frame, so the user can experience the crowd from inside
 * it rather than only from the overview. Renders nothing itself -
 * VenueScene must be told to skip its own OrbitControls
 * (disableOrbitControls) while this is mounted, since both would otherwise
 * fight over the same camera each frame.
 *
 * The base facing direction comes from the agent's current SFM velocity,
 * not its route direction - Social Force velocity is what the agent is
 * actually doing this instant (sidestepping, facing into a crowd,
 * momentarily stationary under pressure), which is the more honest "what
 * would this person see" answer. It's lerped rather than snapped because
 * raw per-tick velocity direction is jittery (agent-agent repulsion
 * changes it substantially tick to tick), which would otherwise read as a
 * shaky camera instead of a walking person. Click-and-drag free-look
 * (useDragLook) layers a yaw/pitch offset on top of that base direction.
 */
export function AgentPovCamera({ simulation, agentId }: AgentPovCameraProps) {
  const { camera } = useThree();
  const baseDir = useRef(new THREE.Vector3(0, 0, -1));
  const { yaw, pitch } = useDragLook(agentId);
  const lookAtScratch = useRef(new THREE.Vector3());
  const rightAxisScratch = useRef(new THREE.Vector3());

  useFrame(() => {
    const body = simulation.world.agents.get(agentId);
    if (!body) return;

    const eyeHeight = AGENT_RENDER_HEIGHT_M * AGENT_EYE_HEIGHT_RATIO;
    camera.position.set(body.position.x, eyeHeight, body.position.y);

    const speed = Math.hypot(body.velocity.x, body.velocity.y);
    if (speed > 0.05) {
      const targetDir = new THREE.Vector3(body.velocity.x, 0, body.velocity.y).normalize();
      baseDir.current.lerp(targetDir, 0.15);
      if (baseDir.current.lengthSq() > 1e-9) baseDir.current.normalize();
    }

    // Layer free-look on top of the walking-direction base: yaw around
    // world up, then pitch around the resulting horizontal "right" axis so
    // looking up/down doesn't also roll the view.
    const viewDir = baseDir.current.clone().applyAxisAngle(UP, yaw.current);
    if (pitch.current !== 0) {
      rightAxisScratch.current.crossVectors(UP, viewDir).normalize();
      viewDir.applyAxisAngle(rightAxisScratch.current, pitch.current);
    }

    lookAtScratch.current.copy(camera.position).add(viewDir);
    camera.lookAt(lookAtScratch.current);
  });

  return null;
}
