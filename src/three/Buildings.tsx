import type { Building } from "../domain/buildings";

// Small deterministic lightness variation per building so a whole block
// doesn't read as one flat slab, without needing per-building random color
// state (index is stable across re-renders since layout is deterministic).
const PALETTE = ["#3d4148", "#42464e", "#393d44", "#464a52", "#3a3e45"];

export function BuildingMesh({ building, colorIndex }: { building: Building; colorIndex: number }) {
  return (
    <mesh position={[building.x, building.height / 2, building.y]}>
      <boxGeometry args={[building.width, building.height, building.depth]} />
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
