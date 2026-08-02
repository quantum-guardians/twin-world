import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { VenueSimulation } from "../simulation/engine";
import { AGENT_EYE_HEIGHT_RATIO } from "../domain/simPresets";

export interface AgentPovCameraProps {
  simulation: VenueSimulation;
  agentId: string;
}

const UP = new THREE.Vector3(0, 1, 0);
const LOOK_SENSITIVITY = 0.0035; // radians per pixel of drag
const MAX_PITCH = Math.PI / 2 - 0.05;

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
 * shaky camera instead of a walking person.
 *
 * On top of that base direction, click-and-drag free-look (yaw/pitch
 * offsets from pointer movement) lets the user actually look around the
 * crowd instead of only ever staring straight ahead - position still
 * follows the agent, only the view direction responds to the drag.
 */
export function AgentPovCamera({ simulation, agentId }: AgentPovCameraProps) {
  const { camera, gl } = useThree();
  const baseDir = useRef(new THREE.Vector3(0, 0, -1));
  const userYaw = useRef(0);
  const userPitch = useRef(0);
  const lookAtScratch = useRef(new THREE.Vector3());
  const rightAxisScratch = useRef(new THREE.Vector3());

  // Reset free-look when switching to a different agent, so each new POV
  // starts facing forward rather than wherever the previous one left off.
  useEffect(() => {
    userYaw.current = 0;
    userPitch.current = 0;
  }, [agentId]);

  useEffect(() => {
    const el = gl.domElement;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      el.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      userYaw.current -= dx * LOOK_SENSITIVITY;
      userPitch.current = THREE.MathUtils.clamp(userPitch.current - dy * LOOK_SENSITIVITY, -MAX_PITCH, MAX_PITCH);
    };
    const onPointerUp = (e: PointerEvent) => {
      dragging = false;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        // Capture may already be gone (e.g. pointer left the element) - fine to ignore.
      }
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointerleave", onPointerUp);
    const previousTouchAction = el.style.touchAction;
    el.style.touchAction = "none";

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointerleave", onPointerUp);
      el.style.touchAction = previousTouchAction;
    };
  }, [gl]);

  useFrame(() => {
    const body = simulation.world.agents.get(agentId);
    const agent = simulation.agents.find((a) => a.id === agentId);
    if (!body || !agent) return;

    const eyeHeight = agent.renderHeightM * AGENT_EYE_HEIGHT_RATIO;
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
    const viewDir = baseDir.current.clone().applyAxisAngle(UP, userYaw.current);
    if (userPitch.current !== 0) {
      rightAxisScratch.current.crossVectors(UP, viewDir).normalize();
      viewDir.applyAxisAngle(rightAxisScratch.current, userPitch.current);
    }

    lookAtScratch.current.copy(camera.position).add(viewDir);
    camera.lookAt(lookAtScratch.current);
  });

  return null;
}
