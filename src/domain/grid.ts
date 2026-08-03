import type { Venue } from "./types";
import { isPointInWalkableArea, pointInCorridor, type Corridor, type JunctionHub, type Point } from "./corridors";
import { DEFAULT_BUILDING_LAYOUT } from "./buildings";

/** Heat cells are one building lot across, so the map reads as blocks of
 * ground rather than a fine mesh - and so a cell is the same unit of area
 * whether it holds a building or open street. */
export const DEFAULT_CELL_SIZE = DEFAULT_BUILDING_LAYOUT.cellSize;
/** Ring of cells kept beyond the venue's node bounding box, so streets that
 * end at the outermost node still get a full cell. */
const GRID_PADDING = 20;
/** Walkable share of a cell is estimated from an NxN lattice of samples -
 * cheap, one-off, and only needs to be good enough to tell a full-width
 * street cell from one a street merely clips. */
const SAMPLES_PER_AXIS = 3;

export interface WorldGrid {
  cellSize: number;
  minX: number;
  minY: number;
  cols: number;
  rows: number;
  /** Share of each cell that is open ground (street or junction plaza)
   * rather than building, in [0, 1], indexed by cell. Zero means the cell
   * is entirely built up. */
  walkableFraction: Float32Array;
  /** Corridor running through a cell, where one does - used to flag the
   * cells of a bottleneck corridor. */
  corridorIdByCell: Map<number, string>;
}

export function cellCenter(grid: WorldGrid, index: number): Point {
  return {
    x: grid.minX + ((index % grid.cols) + 0.5) * grid.cellSize,
    y: grid.minY + (Math.floor(index / grid.cols) + 0.5) * grid.cellSize,
  };
}

/** People per m² of *open ground* in a cell. Dividing by the cell's own
 * area instead would read a packed alley as empty just because the same
 * cell also covers half a city block. */
export function cellDensity(grid: WorldGrid, counts: Uint16Array, index: number): number {
  const walkableArea = grid.walkableFraction[index] * grid.cellSize * grid.cellSize;
  return walkableArea > 0 ? counts[index] / walkableArea : 0;
}

/**
 * Lays one square grid over the whole venue, independent of where the
 * streets run: density is a property of an area, not of a road. Each cell
 * carries how much of it is open ground, which is also what says where
 * buildings stand and where they don't.
 */
export function buildWorldGrid(
  venue: Venue,
  corridors: Corridor[],
  hubs: JunctionHub[],
  cellSize: number = DEFAULT_CELL_SIZE
): WorldGrid {
  const empty: WorldGrid = {
    cellSize,
    minX: 0,
    minY: 0,
    cols: 0,
    rows: 0,
    walkableFraction: new Float32Array(0),
    corridorIdByCell: new Map(),
  };
  if (venue.nodes.length === 0) return empty;

  const xs = venue.nodes.map((n) => n.x);
  const ys = venue.nodes.map((n) => n.y);
  const minX = Math.min(...xs) - GRID_PADDING;
  const minY = Math.min(...ys) - GRID_PADDING;
  const cols = Math.ceil((Math.max(...xs) + GRID_PADDING - minX) / cellSize);
  const rows = Math.ceil((Math.max(...ys) + GRID_PADDING - minY) / cellSize);

  const sampleCount = SAMPLES_PER_AXIS * SAMPLES_PER_AXIS;
  const walkableFraction = new Float32Array(cols * rows);
  const corridorIdByCell = new Map<number, string>();

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let walkable = 0;
      let owner: Corridor | undefined;
      for (let sy = 0; sy < SAMPLES_PER_AXIS; sy++) {
        for (let sx = 0; sx < SAMPLES_PER_AXIS; sx++) {
          const p: Point = {
            x: minX + (col + (sx + 0.5) / SAMPLES_PER_AXIS) * cellSize,
            y: minY + (row + (sy + 0.5) / SAMPLES_PER_AXIS) * cellSize,
          };
          if (!isPointInWalkableArea(p, corridors, hubs)) continue;
          walkable++;
          owner ??= corridors.find((c) => pointInCorridor(p, c));
        }
      }
      const index = row * cols + col;
      walkableFraction[index] = walkable / sampleCount;
      if (owner) corridorIdByCell.set(index, owner.id);
    }
  }

  return { cellSize, minX, minY, cols, rows, walkableFraction, corridorIdByCell };
}

/** Bins agents into cells by direct index arithmetic - one pass over the
 * crowd, no per-cell or per-corridor scan - and reuses `into` so repeated
 * sampling allocates nothing. */
export function countAgentsPerCell(
  grid: WorldGrid,
  bodies: Iterable<{ position: Point }>,
  into: Uint16Array = new Uint16Array(grid.cols * grid.rows)
): Uint16Array {
  into.fill(0);
  for (const { position } of bodies) {
    const col = Math.floor((position.x - grid.minX) / grid.cellSize);
    const row = Math.floor((position.y - grid.minY) / grid.cellSize);
    if (col < 0 || col >= grid.cols || row < 0 || row >= grid.rows) continue;
    into[row * grid.cols + col] += 1;
  }
  return into;
}
