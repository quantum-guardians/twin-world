import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { VenueSimulation } from "../simulation/engine";
import { AGENT_COLOR_ARRIVED, AGENT_COLOR_DEAD, AGENT_COLOR_MOVING } from "./sceneColors";

// Unit capsule (radius 0.5, cylindrical body length 1 -> total height 2).
// InstancedMesh requires one shared geometry, so a mixed crowd of
// different sizes is achieved by non-uniformly scaling each instance in
// useFrame to reach that agent's actual renderHeightM/radius rather than
// building a geometry per agent.
const UNIT_RADIUS = 0.5;
const UNIT_BODY_LENGTH = 1;
const UNIT_HEIGHT = UNIT_BODY_LENGTH + 2 * UNIT_RADIUS;

const COLOR_MOVING = new THREE.Color(AGENT_COLOR_MOVING);
const COLOR_ARRIVED = new THREE.Color(AGENT_COLOR_ARRIVED);
const COLOR_DEAD = new THREE.Color(AGENT_COLOR_DEAD);

export interface AgentsProps {
  simulation: VenueSimulation;
  /** Upper bound on concurrently rendered agents (the instanced mesh is
   * allocated once at this size); pass the scenario's total population. */
  capacity: number;
}

/**
 * Renders every agent as one instance of a shared capsule mesh, positions/
 * scale/colors updated imperatively in useFrame by reading the
 * simulation's mutable state directly. Population can reach the hundreds
 * at 60 Hz, so this intentionally bypasses React's per-agent
 * reconciliation (no <mesh> per agent) - only the instance buffers are
 * touched each frame. Each capsule's radius is the body's SFM collision
 * radius, so the rendered shoulder width matches the physics exactly.
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

      const height = agent.renderHeightM;
      const radius = body.radius;
      dummy.position.set(body.position.x, height / 2, body.position.y);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(radius / UNIT_RADIUS, height / UNIT_HEIGHT, radius / UNIT_RADIUS);
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
      <capsuleGeometry args={[UNIT_RADIUS, UNIT_BODY_LENGTH, 4, 8]} />
      <meshStandardMaterial />
    </instancedMesh>
  );
}
