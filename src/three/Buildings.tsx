import type { Building } from "../domain/buildings";
import { GROUND_Y } from "./sceneLayout";
// Index is stable across re-renders since the layout is deterministic, so
// picking from the palette by index needs no per-building color state.
import { BUILDING_PALETTE } from "./sceneColors";

export function BuildingMesh({ building, colorIndex }: { building: Building; colorIndex: number }) {
  // Modelled from the ground plane up to `height` above street level, so the
  // block still meets the ground even though the ground sits below y=0.
  const meshHeight = building.height - GROUND_Y;
  return (
    <mesh position={[building.x, GROUND_Y + meshHeight / 2, building.y]}>
      <boxGeometry args={[building.width, meshHeight, building.depth]} />
      <meshStandardMaterial
        color={BUILDING_PALETTE[colorIndex % BUILDING_PALETTE.length]}
        roughness={0.8}
      />
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
