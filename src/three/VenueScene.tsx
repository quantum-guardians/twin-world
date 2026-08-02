import { useMemo, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import type { Venue } from "../domain/types";
import { buildCorridors } from "../domain/corridors";
import { generateBuildings } from "../domain/buildings";
import { StreetFloor } from "./StreetFloor";
import { Buildings } from "./Buildings";
import { NodeMarkers } from "./NodeMarkers";

function useVenueGeometry(venue: Venue) {
  return useMemo(() => {
    const { corridors, hubs } = buildCorridors(venue);
    const buildings = generateBuildings(venue, corridors, hubs);

    const xs = venue.nodes.map((n) => n.x);
    const ys = venue.nodes.map((n) => n.y);
    const minX = xs.length ? Math.min(...xs) : 0;
    const maxX = xs.length ? Math.max(...xs) : 100;
    const minY = ys.length ? Math.min(...ys) : 0;
    const maxY = ys.length ? Math.max(...ys) : 100;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const diagonal = Math.max(Math.hypot(maxX - minX, maxY - minY), 40);

    return { corridors, hubs, buildings, centerX, centerY, diagonal };
  }, [venue]);
}

export interface VenueSceneProps {
  venue: Venue;
  children?: ReactNode;
  /** Skip the default overview camera position + OrbitControls - used for
   * "에이전트 시점" mode, where a child (AgentPovCamera) drives the active
   * camera's position/orientation every frame instead. Both would otherwise
   * fight over the same camera each frame. */
  disableOrbitControls?: boolean;
  /** Wider FOV reads more naturally for an eye-level first-person view than
   * the default overview framing. */
  fov?: number;
}

export function VenueScene({ venue, children, disableOrbitControls = false, fov = 50 }: VenueSceneProps) {
  const { corridors, hubs, buildings, centerX, centerY, diagonal } = useVenueGeometry(venue);

  const camDistance = diagonal * 0.9;
  const camPosition: [number, number, number] = [
    centerX + camDistance * 0.6,
    camDistance * 0.7,
    centerY + camDistance * 0.9,
  ];

  return (
    <div className="venue-scene">
      <Canvas shadows={false}>
        {/* Keyed on mode so leaving "에이전트 시점" remounts the camera and
            re-applies `position` fresh - drei's PerspectiveCamera only sets
            `position` once on mount, so without this the camera would stay
            wherever AgentPovCamera last left it instead of snapping back to
            the overview framing. */}
        <PerspectiveCamera
          key={disableOrbitControls ? "pov-camera" : "overview-camera"}
          makeDefault
          position={camPosition}
          fov={fov}
          near={0.1}
          far={diagonal * 8}
        />
        {!disableOrbitControls && (
          <OrbitControls target={[centerX, 0, centerY]} maxPolarAngle={Math.PI / 2 - 0.02} />
        )}
        <ambientLight intensity={0.55} />
        <directionalLight position={[centerX + diagonal, diagonal, centerY + diagonal * 0.5]} intensity={1.1} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[centerX, -0.05, centerY]}>
          <planeGeometry args={[diagonal * 6, diagonal * 6]} />
          <meshStandardMaterial color="#101216" roughness={1} />
        </mesh>
        <StreetFloor corridors={corridors} hubs={hubs} />
        <Buildings buildings={buildings} />
        <NodeMarkers nodes={venue.nodes} />
        {children}
      </Canvas>
    </div>
  );
}
