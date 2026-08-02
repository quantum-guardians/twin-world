import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { VenueSimulation } from "../simulation/engine";
import { AGENT_RADIUS } from "../domain/simPresets";

const AGENT_HEIGHT = 1.6; // m, purely visual (capsule height incl. caps)
const CAPSULE_BODY_LENGTH = Math.max(AGENT_HEIGHT - 2 * AGENT_RADIUS, 0.05);

const COLOR_MOVING = new THREE.Color("#e8c15a");
const COLOR_ARRIVED = new THREE.Color("#4a5162");
const COLOR_DEAD = new THREE.Color("#8a2f2f");

export interface AgentsProps {
  simulation: VenueSimulation;
  /** Upper bound on concurrently rendered agents (the instanced mesh is
   * allocated once at this size); pass the scenario's total population. */
  capacity: number;
}

/**
 * Renders every agent as one instance of a shared capsule mesh, positions
 * and colors updated imperatively in useFrame by reading the simulation's
 * mutable state directly. Population can reach the hundreds at 60 Hz, so
 * this intentionally bypasses React's per-agent reconciliation (no <mesh>
 * per agent) - only the instance buffers are touched each frame.
 */
export function Agents({ simulation, capacity }: AgentsProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const safeCapacity = Math.max(capacity, 1);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    let i = 0;
    for (const agent of simulation.agents) {
      const body = simulation.world.agents.get(agent.id);
      if (!body) continue;
      if (i >= safeCapacity) break;

      dummy.position.set(body.position.x, AGENT_HEIGHT / 2, body.position.y);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      const color = agent.state === "dead" ? COLOR_DEAD : agent.state === "arrived" ? COLOR_ARRIVED : COLOR_MOVING;
      mesh.setColorAt(i, color);
      i++;
    }
    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, safeCapacity]} frustumCulled={false}>
      <capsuleGeometry args={[AGENT_RADIUS, CAPSULE_BODY_LENGTH, 4, 8]} />
      <meshStandardMaterial />
    </instancedMesh>
  );
}
