import type { Corridor, JunctionHub } from "../domain/corridors";

const STREET_COLOR = "#33363d";
const STREET_THICKNESS = 0.15;

export function CorridorMesh({ corridor }: { corridor: Corridor }) {
  const midX = (corridor.a.x + corridor.b.x) / 2;
  const midY = (corridor.a.y + corridor.b.y) / 2;
  return (
    <mesh position={[midX, STREET_THICKNESS / 2, midY]} rotation={[0, -corridor.angle, 0]}>
      <boxGeometry args={[corridor.length, STREET_THICKNESS, corridor.width]} />
      <meshStandardMaterial color={STREET_COLOR} roughness={0.95} />
    </mesh>
  );
}

export function HubMesh({ hub }: { hub: JunctionHub }) {
  return (
    <mesh position={[hub.center.x, STREET_THICKNESS / 2, hub.center.y]}>
      <cylinderGeometry args={[hub.radius, hub.radius, STREET_THICKNESS, 24]} />
      <meshStandardMaterial color={STREET_COLOR} roughness={0.95} />
    </mesh>
  );
}

export function StreetFloor({ corridors, hubs }: { corridors: Corridor[]; hubs: JunctionHub[] }) {
  return (
    <group>
      {corridors.map((c) => (
        <CorridorMesh key={c.id} corridor={c} />
      ))}
      {hubs.map((h) => (
        <HubMesh key={h.nodeId} hub={h} />
      ))}
    </group>
  );
}
