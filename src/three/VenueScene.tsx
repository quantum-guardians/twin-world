import { useMemo, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import type { Venue } from "../domain/types";
import { buildCorridors } from "../domain/corridors";
import { generateBuildings } from "../domain/buildings";
import { StreetFloor } from "./StreetFloor";
import { Buildings } from "./Buildings";
import { NodeMarkers } from "./NodeMarkers";
import { GROUND_Y } from "./sceneLayout";
import { GROUND_COLOR, SKY_COLOR } from "./sceneColors";

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
          // Depth precision is set by the far/near ratio, and a venue that
          // spans hundreds of meters made it large enough that the street
          // slab and the ground plane 0.2 m below it resolved to the same
          // depth at grazing angles - the road surface flickered. Raising
          // near and tightening far shrinks that ratio by ~10x. near stays
          // below the agent-POV eye height so nothing clips in first person.
          near={0.5}
          far={diagonal * 4}
        />
        {!disableOrbitControls && (
          <OrbitControls target={[centerX, 0, centerY]} maxPolarAngle={Math.PI / 2 - 0.02} />
        )}
        <color attach="background" args={[SKY_COLOR]} />
        {/* Haze thickening toward the far edge of the venue: without it a
            uniformly lit daylight scene has no depth cue at distance, and the
            outer ring of generated blocks reads as a flat wall. */}
        <fog attach="fog" args={[SKY_COLOR, diagonal * 2.5, diagonal * 6]} />
        {/* Overcast-daylight rig: sky/ground hemisphere for the ambient fill
            plus one sun for direction. Bright enough that the density ramp is
            read from its own hue rather than from how lit a street is. */}
        <hemisphereLight args={[SKY_COLOR, GROUND_COLOR, 0.8]} />
        <ambientLight intensity={0.25} />
        <directionalLight position={[centerX + diagonal, diagonal, centerY + diagonal * 0.5]} intensity={1.2} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[centerX, GROUND_Y, centerY]}>
          <planeGeometry args={[diagonal * 6, diagonal * 6]} />
          <meshStandardMaterial color={GROUND_COLOR} roughness={1} />
        </mesh>
        <StreetFloor corridors={corridors} hubs={hubs} />
        <Buildings buildings={buildings} />
        <NodeMarkers nodes={venue.nodes} />
        {children}
      </Canvas>
    </div>
  );
}
