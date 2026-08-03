import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { VenueSimulation } from "../simulation/engine";
import { AGENT_RENDER_HEIGHT_M } from "../domain/simPresets";
import { AGENT_COLOR_ARRIVED, AGENT_COLOR_DEAD, AGENT_COLOR_HAIR, AGENT_COLOR_MOVING } from "./sceneColors";

// Unit capsule (radius 0.5, cylindrical body length 1 -> total height 2),
// scaled per instance in useFrame to the shared agent height/radius.
const UNIT_RADIUS = 0.5;
const UNIT_BODY_LENGTH = 1;
const UNIT_HEIGHT = UNIT_BODY_LENGTH + 2 * UNIT_RADIUS;

// Hair is a dark ellipsoid shell over the capsule's top cap: it always
// covers the head, and the random per-agent length hangs below it. Slightly
// wider than the body so it reads as hair rather than z-fighting with the
// scalp.
const UNIT_SPHERE_RADIUS = 0.5;
const HAIR_RADIUS_MARGIN = 1.08;

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
  const hairRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const safeCapacity = Math.max(capacity, 1);

  useFrame(() => {
    const mesh = meshRef.current;
    const hair = hairRef.current;
    if (!mesh || !hair) return;

    let i = 0;
    for (const agent of simulation.agents) {
      const body = simulation.world.agents.get(agent.id);
      if (!body) continue;
      if (i >= safeCapacity) break;

      const height = AGENT_RENDER_HEIGHT_M;
      const radius = body.radius;
      dummy.position.set(body.position.x, height / 2, body.position.y);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(radius / UNIT_RADIUS, height / UNIT_HEIGHT, radius / UNIT_RADIUS);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      const color = agent.state === "dead" ? COLOR_DEAD : agent.state === "arrived" ? COLOR_ARRIVED : COLOR_MOVING;
      mesh.setColorAt(i, color);

      // Ellipsoid spanning the head cap plus this agent's hair length: its
      // top sits on the scalp, its bottom hangs hairLengthM below the head.
      const hairRadius = radius * HAIR_RADIUS_MARGIN;
      const hairSemiY = hairRadius + agent.hairLengthM / 2;
      dummy.position.set(body.position.x, height - radius - agent.hairLengthM / 2, body.position.y);
      dummy.scale.set(
        hairRadius / UNIT_SPHERE_RADIUS,
        hairSemiY / UNIT_SPHERE_RADIUS,
        hairRadius / UNIT_SPHERE_RADIUS
      );
      dummy.updateMatrix();
      hair.setMatrixAt(i, dummy.matrix);
      i++;
    }
    mesh.count = i;
    hair.count = i;
    mesh.instanceMatrix.needsUpdate = true;
    hair.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={meshRef} args={[undefined, undefined, safeCapacity]} frustumCulled={false}>
        <capsuleGeometry args={[UNIT_RADIUS, UNIT_BODY_LENGTH, 4, 8]} />
        <meshStandardMaterial />
      </instancedMesh>
      <instancedMesh ref={hairRef} args={[undefined, undefined, safeCapacity]} frustumCulled={false}>
        <sphereGeometry args={[UNIT_SPHERE_RADIUS, 8, 6]} />
        <meshStandardMaterial color={AGENT_COLOR_HAIR} roughness={0.85} />
      </instancedMesh>
    </>
  );
}
