import type { Venue } from "./types";
import { isPointInWalkableArea, type Corridor, type JunctionHub } from "./corridors";
import { mulberry32 } from "./rng";

export interface Building {
  id: string;
  x: number;
  y: number;
  width: number;
  depth: number;
  height: number;
}

export interface BuildingLayoutOptions {
  /** Building lot size before the gap is subtracted, in meters. */
  cellSize: number;
  /** Gap left between adjacent lots and between a lot and the street. */
  gap: number;
  /** Extra ring of lots generated beyond the venue's node bounding box. */
  padding: number;
  minHeight: number;
  maxHeight: number;
  /** Share of free lots left as vacant ground so blocks aren't solid walls. */
  emptyLotChance: number;
  seed: number;
}

export const DEFAULT_BUILDING_LAYOUT: BuildingLayoutOptions = {
  cellSize: 24,
  gap: 4,
  padding: 60,
  minHeight: 8,
  maxHeight: 28,
  emptyLotChance: 0.18,
  seed: 1,
};

/** Longest side of a building in lots (1, 2 or 3 cells). */
const MAX_SPAN = 3;

/** Height tiers rather than one flat uniform range, so a block mixes
 * low-rise shops with the odd tower instead of averaging out. */
function pickHeight(rng: () => number, minHeight: number, maxHeight: number): number {
  const range = maxHeight - minHeight;
  const tier = rng();
  if (tier < 0.4) return minHeight + rng() * range * 0.25;
  if (tier < 0.75) return minHeight + range * (0.25 + rng() * 0.35);
  if (tier < 0.94) return minHeight + range * (0.6 + rng() * 0.4);
  return minHeight + range * (1 + rng() * 0.9);
}

/** Fills the area outside the street/hub footprint with rectangular building
 * blocks laid out on a lot grid: each block covers 1-3 adjacent lots along
 * one axis, some lots are left vacant, and heights come from tiers so a row
 * reads as a mixed streetscape. Any lot whose corners or center would
 * overlap a corridor or junction hub is skipped. This is a deliberately
 * crude procedural fill, not a GIS reconstruction - the plan document rules
 * out recovering real building shapes from the graph alone, so the MVP only
 * needs blocks that read as "buildings" and never intrude on walkable
 * space. Deterministic per `options.seed` so repeated runs (and tests)
 * produce the same layout. */
export function generateBuildings(
  venue: Venue,
  corridors: Corridor[],
  hubs: JunctionHub[],
  options: BuildingLayoutOptions = DEFAULT_BUILDING_LAYOUT
): Building[] {
  if (venue.nodes.length === 0) return [];

  const { cellSize, gap, padding, minHeight, maxHeight, emptyLotChance, seed } = options;
  const rng = mulberry32(seed);

  const xs = venue.nodes.map((n) => n.x);
  const ys = venue.nodes.map((n) => n.y);
  const minX = Math.min(...xs) - padding;
  const maxX = Math.max(...xs) + padding;
  const minY = Math.min(...ys) - padding;
  const maxY = Math.max(...ys) + padding;

  const footprint = cellSize - gap;
  const half = footprint / 2;

  const centersX: number[] = [];
  for (let cx = minX + cellSize / 2; cx < maxX; cx += cellSize) centersX.push(cx);
  const centersY: number[] = [];
  for (let cy = minY + cellSize / 2; cy < maxY; cy += cellSize) centersY.push(cy);

  // A lot is usable when neither its corners nor its center touch the street.
  const usable = centersY.map((cy) =>
    centersX.map((cx) => {
      const probes = [
        { x: cx - half, y: cy - half },
        { x: cx + half, y: cy - half },
        { x: cx - half, y: cy + half },
        { x: cx + half, y: cy + half },
        { x: cx, y: cy },
      ];
      return !probes.some((p) => isPointInWalkableArea(p, corridors, hubs, gap));
    })
  );
  const taken = centersY.map(() => centersX.map(() => false));

  const buildings: Building[] = [];
  let index = 0;

  for (let row = 0; row < centersY.length; row += 1) {
    for (let col = 0; col < centersX.length; col += 1) {
      if (!usable[row][col] || taken[row][col]) continue;

      if (rng() < emptyLotChance) {
        taken[row][col] = true;
        continue;
      }

      // Grow the lot along one axis while neighbours are free.
      const horizontal = rng() < 0.5;
      const wanted = 1 + Math.floor(rng() * MAX_SPAN);
      let span = 1;
      while (span < wanted) {
        const r = horizontal ? row : row + span;
        const c = horizontal ? col + span : col;
        if (r >= centersY.length || c >= centersX.length) break;
        if (!usable[r][c] || taken[r][c]) break;
        span += 1;
      }

      const spanX = horizontal ? span : 1;
      const spanY = horizontal ? 1 : span;
      for (let r = row; r < row + spanY; r += 1) {
        for (let c = col; c < col + spanX; c += 1) taken[r][c] = true;
      }

      index += 1;
      buildings.push({
        id: `bldg-${index}`,
        x: centersX[col] + ((spanX - 1) * cellSize) / 2,
        y: centersY[row] + ((spanY - 1) * cellSize) / 2,
        width: spanX * cellSize - gap,
        depth: spanY * cellSize - gap,
        height: pickHeight(rng, minHeight, maxHeight),
      });
    }
  }

  return buildings;
}
