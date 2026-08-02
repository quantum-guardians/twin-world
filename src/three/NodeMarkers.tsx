import type { VenueNode } from "../domain/types";
import { KIND_COLOR } from "../domain/nodeColors";

const MARKER_HEIGHT = 3;
const MARKER_RADIUS = 1.2;

/** Only entrance/exit/destination nodes get a visible marker - plain
 * junction ("normal") nodes are already legible as street corners once the
 * corridor floor is drawn, and marking all of them would clutter the scene. */
export function NodeMarkers({ nodes }: { nodes: VenueNode[] }) {
  const notable = nodes.filter((n) => n.kind !== "normal");
  return (
    <group>
      {notable.map((n) => (
        <mesh key={n.id} position={[n.x, MARKER_HEIGHT / 2, n.y]}>
          <coneGeometry args={[MARKER_RADIUS, MARKER_HEIGHT, 12]} />
          <meshStandardMaterial color={KIND_COLOR[n.kind]} emissive={KIND_COLOR[n.kind]} emissiveIntensity={0.3} />
        </mesh>
      ))}
    </group>
  );
}
