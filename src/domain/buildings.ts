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
  seed: number;
}

export const DEFAULT_BUILDING_LAYOUT: BuildingLayoutOptions = {
  cellSize: 24,
  gap: 4,
  padding: 60,
  minHeight: 8,
  maxHeight: 28,
  seed: 1,
};

/** Fills the area outside the street/hub footprint with simple rectangular
 * building blocks on a regular grid, skipping any lot whose corners or
 * center would overlap a corridor or junction hub. This is a deliberately
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

  const { cellSize, gap, padding, minHeight, maxHeight, seed } = options;
  const rng = mulberry32(seed);

  const xs = venue.nodes.map((n) => n.x);
  const ys = venue.nodes.map((n) => n.y);
  const minX = Math.min(...xs) - padding;
  const maxX = Math.max(...xs) + padding;
  const minY = Math.min(...ys) - padding;
  const maxY = Math.max(...ys) + padding;

  const footprint = cellSize - gap;
  const buildings: Building[] = [];

  let index = 0;
  for (let cy = minY + cellSize / 2; cy < maxY; cy += cellSize) {
    for (let cx = minX + cellSize / 2; cx < maxX; cx += cellSize) {
      const half = footprint / 2;
      const corners = [
        { x: cx - half, y: cy - half },
        { x: cx + half, y: cy - half },
        { x: cx - half, y: cy + half },
        { x: cx + half, y: cy + half },
        { x: cx, y: cy },
      ];
      const overlapsStreet = corners.some((p) => isPointInWalkableArea(p, corridors, hubs, gap));
      if (overlapsStreet) continue;

      index += 1;
      buildings.push({
        id: `bldg-${index}`,
        x: cx,
        y: cy,
        width: footprint,
        depth: footprint,
        height: minHeight + rng() * (maxHeight - minHeight),
      });
    }
  }

  return buildings;
}
