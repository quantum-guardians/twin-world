import type { Building } from "../domain/buildings";
import { GROUND_Y } from "./sceneLayout";

// Small deterministic lightness variation per building so a whole block
// doesn't read as one flat slab, without needing per-building random color
// state (index is stable across re-renders since layout is deterministic).
const PALETTE = ["#3d4148", "#42464e", "#393d44", "#464a52", "#3a3e45"];

export function BuildingMesh({ building, colorIndex }: { building: Building; colorIndex: number }) {
  // Modelled from the ground plane up to `height` above street level, so the
  // block still meets the ground even though the ground sits below y=0.
  const meshHeight = building.height - GROUND_Y;
  return (
    <mesh position={[building.x, GROUND_Y + meshHeight / 2, building.y]}>
      <boxGeometry args={[building.width, meshHeight, building.depth]} />
      <meshStandardMaterial color={PALETTE[colorIndex % PALETTE.length]} roughness={0.85} />
    </mesh>
  );
}

export function Buildings({ buildings }: { buildings: Building[] }) {
  return (
    <group>
      {buildings.map((b, i) => (
        <BuildingMesh key={b.id} building={b} colorIndex={i} />
      ))}
    </group>
  );
}
