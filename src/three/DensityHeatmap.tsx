import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { VenueSimulation } from "../simulation/engine";
import { getDensityColor } from "../domain/density";

// Sits just above StreetFloor's corridor meshes (which are centered on
// y=0 with a small thickness) so the heat tint renders on top without
// z-fighting.
const OVERLAY_Y = 0.18;
const BOTTLENECK_COLOR = "#ff3b3b";

/**
 * One thin, near-transparent box per corridor (same position/rotation math
 * as StreetFloor's CorridorMesh, so it sits exactly on top of the street)
 * whose color/opacity is driven by simulation.densityByCorridor and
 * simulation.bottleneckCorridorIds - see plan: "바닥 밀집도 히트맵" +
 * "병목 간선·노드 표시". Colors update imperatively in useFrame rather
 * than through React props/state, matching Agents.tsx's approach, since
 * density is recomputed multiple times per second independent of React's
 * render cycle.
 */
export function DensityHeatmap({ simulation }: { simulation: VenueSimulation }) {
  const materialsByCorridorId = useRef(new Map<string, THREE.MeshBasicMaterial>());

  useFrame(() => {
    for (const corridor of simulation.corridors) {
      const material = materialsByCorridorId.current.get(corridor.id);
      if (!material) continue;
      const density = simulation.densityByCorridor.get(corridor.id) ?? 0;
      const isBottleneck = simulation.bottleneckCorridorIds.has(corridor.id);
      material.color.set(isBottleneck ? BOTTLENECK_COLOR : getDensityColor(density));
      material.opacity = isBottleneck ? 0.8 : Math.min(0.12 + density * 0.65, 0.75);
    }
  });

  return (
    <group>
      {simulation.corridors.map((corridor) => {
        const midX = (corridor.a.x + corridor.b.x) / 2;
        const midY = (corridor.a.y + corridor.b.y) / 2;
        return (
          <mesh key={corridor.id} position={[midX, OVERLAY_Y, midY]} rotation={[0, -corridor.angle, 0]}>
            <boxGeometry args={[corridor.length, 0.02, corridor.width]} />
            <meshBasicMaterial
              ref={(material) => {
                if (material) materialsByCorridorId.current.set(corridor.id, material);
              }}
              transparent
              opacity={0.12}
              color="#3fa76b"
              depthWrite={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}
