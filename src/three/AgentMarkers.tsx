import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { VenueSimulation } from "../simulation/engine";
import { AGENT_RENDER_HEIGHT_M } from "../domain/simPresets";
import { AGENT_COLOR_ARRIVED, AGENT_COLOR_DEAD, AGENT_COLOR_MOVING } from "./sceneColors";

// Camera-to-nearest-agent distance band over which markers fade in. Inside
// FADE_NEAR_M the exaggerated ~6-7.5 m capsules are already readable on
// screen, so markers stay hidden (this also keeps them out of the
// first-person view, which is always inside the crowd); past FADE_FAR_M
// even the enlarged bodies shrink to a few pixels and the constant-size
// dots take over.
const MARKER_FADE_NEAR_M = 250;
const MARKER_FADE_FAR_M = 450;

/** Screen-space dot diameter (CSS px); constant regardless of camera
 * distance because sizeAttenuation is off. */
const MARKER_SIZE_PX = 7;

/** Dots float above heads so a marker never sits inside its own capsule. */
const MARKER_HEAD_OFFSET_M = 0.6;

const COLOR_MOVING = new THREE.Color(AGENT_COLOR_MOVING);
const COLOR_ARRIVED = new THREE.Color(AGENT_COLOR_ARRIVED);
const COLOR_DEAD = new THREE.Color(AGENT_COLOR_DEAD);

/** Soft-edged white disc; tinted per point via vertexColors, so one texture
 * serves every agent state. */
function makeDiscTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.8, "rgba(255,255,255,1)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

export interface AgentMarkersProps {
  simulation: VenueSimulation;
  /** Upper bound on concurrently rendered agents (attribute buffers are
   * allocated once at this size); pass the scenario's total population. */
  capacity: number;
}

/**
 * Overview legibility aid: one constant-pixel-size dot per agent, drawn as a
 * single THREE.Points cloud. Rendered agents are true human scale, which
 * makes them near-invisible from the default overview camera over a venue
 * spanning hundreds of meters - the dots carry position and state color at
 * that distance, then fade out as the camera gets close enough for the
 * capsules themselves to read. Same imperative useFrame buffer updates as
 * Agents.tsx, for the same population-at-60 Hz reason.
 */
export function AgentMarkers({ simulation, capacity }: AgentMarkersProps) {
  const materialRef = useRef<THREE.PointsMaterial>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const safeCapacity = Math.max(capacity, 1);

  const texture = useMemo(() => makeDiscTexture(), []);
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(safeCapacity * 3), 3).setUsage(THREE.DynamicDrawUsage)
    );
    g.setAttribute(
      "color",
      new THREE.BufferAttribute(new Float32Array(safeCapacity * 3), 3).setUsage(THREE.DynamicDrawUsage)
    );
    g.setDrawRange(0, 0);
    return g;
  }, [safeCapacity]);

  useFrame(({ camera }) => {
    const points = pointsRef.current;
    const material = materialRef.current;
    if (!points || !material) return;

    const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
    const colors = geometry.getAttribute("color") as THREE.BufferAttribute;

    let i = 0;
    let minDistSq = Infinity;
    for (const agent of simulation.agents) {
      const body = simulation.world.agents.get(agent.id);
      if (!body) continue;
      if (i >= safeCapacity) break;

      positions.setXYZ(i, body.position.x, AGENT_RENDER_HEIGHT_M + MARKER_HEAD_OFFSET_M, body.position.y);
      const color = agent.state === "dead" ? COLOR_DEAD : agent.state === "arrived" ? COLOR_ARRIVED : COLOR_MOVING;
      colors.setXYZ(i, color.r, color.g, color.b);

      const dx = camera.position.x - body.position.x;
      const dy = camera.position.y - AGENT_RENDER_HEIGHT_M;
      const dz = camera.position.z - body.position.y;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq < minDistSq) minDistSq = distSq;
      i++;
    }
    geometry.setDrawRange(0, i);
    positions.needsUpdate = true;
    colors.needsUpdate = true;

    const minDist = Math.sqrt(minDistSq);
    const fade = Math.min(1, Math.max(0, (minDist - MARKER_FADE_NEAR_M) / (MARKER_FADE_FAR_M - MARKER_FADE_NEAR_M)));
    material.opacity = fade;
    points.visible = i > 0 && fade > 0.01;
  });

  return (
    <points key={safeCapacity} ref={pointsRef} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        ref={materialRef}
        size={MARKER_SIZE_PX}
        sizeAttenuation={false}
        vertexColors
        map={texture}
        transparent
        depthWrite={false}
        alphaTest={0.05}
      />
    </points>
  );
}
