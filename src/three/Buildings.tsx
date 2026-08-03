import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Building } from "../domain/buildings";
import { GROUND_Y } from "./sceneLayout";
// Index is stable across re-renders since the layout is deterministic, so
// picking from the palette by index needs no per-building color state.
import { BUILDING_PALETTE } from "./sceneColors";

const PALETTE = BUILDING_PALETTE.map((c) => new THREE.Color(c));

/**
 * Every block is one instance of a unit cube, scaled to its lot. A venue
 * fills its whole bounding box with lots, so this runs to several hundred
 * blocks - a mesh each meant several hundred draw calls per frame, which
 * dominated the frame budget next to the crowd itself. Instances are
 * written once per layout, not per frame: `buildings` only changes when
 * the venue does. Blocks are modelled from the ground plane up to `height`
 * above street level, so they still meet the ground even though it sits
 * below y=0.
 */
export function Buildings({ buildings }: { buildings: Building[] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    buildings.forEach((building, i) => {
      const meshHeight = building.height - GROUND_Y;
      dummy.position.set(building.x, GROUND_Y + meshHeight / 2, building.y);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(building.width, meshHeight, building.depth);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, PALETTE[i % PALETTE.length]);
    });
    mesh.count = buildings.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [buildings, dummy]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, Math.max(buildings.length, 1)]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial roughness={0.8} />
    </instancedMesh>
  );
}
