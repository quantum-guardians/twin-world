import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { VenueSimulation } from "../simulation/engine";
import { buildWorldGrid, cellCenter, cellDensity, countAgentsPerCell } from "../domain/grid";
import { getDensityColor } from "../domain/density";
import { BOTTLENECK_COLOR } from "./sceneColors";

// Sits just above the top face of StreetFloor's 0.15 m street slabs, so
// the heat tint renders over the road without z-fighting against it.
const OVERLAY_Y = 0.18;
/** Fraction of a cell actually painted, so the grid reads as a grid. */
const TILE_FILL = 0.94;
/** Fruin's level-of-service F for a walkway starts at 2.17 people/m² -
 * movement breaks down and contact is unavoidable - so the ramp saturates
 * there. Lower it to make moderate crowding stand out sooner. */
const CRITICAL_PEOPLE_PER_SQM = 2.17;
/** Floor on a bottleneck cell's glow, so a flagged corridor stays marked
 * even in the moment its crowd thins out. */
const BOTTLENECK_MIN_GLOW = 0.5;
/** Crowd density moves on the scale of tens of seconds, so sampling it once
 * every few seconds costs one pass over the crowd instead of one per frame
 * and loses nothing anyone could see. */
const SAMPLE_INTERVAL_S = 3;

/**
 * Tints the venue floor by how many people stand in each cell of one grid
 * laid over the whole map, rather than one tint per road: crowding happens
 * over an area, not along an edge, and a cell is the same unit of ground
 * whether a building sits on it or not. Cells with no walkable ground get
 * no tile - that absence is where the buildings are.
 *
 * Tiles are a single InstancedMesh written imperatively, matching
 * Agents.tsx: the counts change independently of React's render cycle.
 */
export function DensityHeatmap({ simulation }: { simulation: VenueSimulation }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const grid = useMemo(
    () => buildWorldGrid(simulation.venue, simulation.corridors, simulation.hubs),
    [simulation]
  );
  const tiles = useMemo(() => {
    const cells: number[] = [];
    grid.walkableFraction.forEach((fraction, cell) => {
      if (fraction > 0) cells.push(cell);
    });
    return cells;
  }, [grid]);
  const counts = useMemo(() => new Uint16Array(grid.cols * grid.rows), [grid]);
  const scratch = useMemo(() => ({ dummy: new THREE.Object3D(), color: new THREE.Color() }), []);
  const secondsSinceSample = useRef(SAMPLE_INTERVAL_S);

  // Tile placement never changes for a given grid, so it is written once
  // rather than every frame.
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const { dummy } = scratch;
    tiles.forEach((cell, i) => {
      const { x, y } = cellCenter(grid, cell);
      dummy.position.set(x, OVERLAY_Y, y);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.count = tiles.length;
    mesh.instanceMatrix.needsUpdate = true;
  }, [grid, tiles, scratch]);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    secondsSinceSample.current += delta;
    if (secondsSinceSample.current < SAMPLE_INTERVAL_S) return;
    secondsSinceSample.current = 0;

    countAgentsPerCell(grid, simulation.world.agents.values(), counts);
    const bottlenecks = simulation.bottleneckCorridorIds;
    const { color } = scratch;

    tiles.forEach((cell, i) => {
      const corridorId = grid.corridorIdByCell.get(cell);
      const heat = Math.min(cellDensity(grid, counts, cell) / CRITICAL_PEOPLE_PER_SQM, 1);
      const isBottleneck = corridorId !== undefined && bottlenecks.has(corridorId);
      color.set(isBottleneck ? BOTTLENECK_COLOR : getDensityColor(heat));
      // Additive blending makes black mean "nothing added", so dimming the
      // ramp by its own heat is what fades an empty cell out entirely - a
      // bottleneck keeps a floor so the warning never disappears.
      color.multiplyScalar(isBottleneck ? Math.max(heat, BOTTLENECK_MIN_GLOW) : heat);
      mesh.setColorAt(i, color);
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, Math.max(tiles.length, 1)]}
      frustumCulled={false}
    >
      <planeGeometry args={[grid.cellSize * TILE_FILL, grid.cellSize * TILE_FILL]} />
      {/* Additive, so an empty (black) cell adds nothing at all and the
          daylight street shows through untouched, while a packed one glows
          on top of whatever it covers. */}
      <meshBasicMaterial transparent blending={THREE.AdditiveBlending} depthWrite={false} />
    </instancedMesh>
  );
}
