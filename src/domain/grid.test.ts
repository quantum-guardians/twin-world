import { describe, expect, it } from "vitest";
import type { Venue } from "./types";
import { buildCorridors } from "./corridors";
import { buildWorldGrid, cellCenter, cellDensity, countAgentsPerCell } from "./grid";

function straightVenue(): Venue {
  return {
    id: "v1",
    name: "straight",
    region: "test",
    scaleMetersPerUnit: 1,
    isSyntheticLayout: true,
    nodes: [
      { id: "a", x: 0, y: 0, kind: "entrance" },
      { id: "b", x: 100, y: 0, kind: "exit" },
    ],
    edges: [{ id: "e1", fromNodeId: "a", toNodeId: "b", width: 10, direction: "bidirectional" }],
  };
}

function grid() {
  const venue = straightVenue();
  const { corridors, hubs } = buildCorridors(venue);
  return buildWorldGrid(venue, corridors, hubs);
}

function bodiesAt(...points: { x: number; y: number }[]) {
  return points.map((position) => ({ position }));
}

describe("buildWorldGrid", () => {
  it("is empty for a venue with no nodes", () => {
    const empty: Venue = { ...straightVenue(), nodes: [], edges: [] };
    expect(buildWorldGrid(empty, [], []).walkableFraction).toHaveLength(0);
  });

  it("covers the whole venue, street and building alike", () => {
    const g = grid();
    expect(g.walkableFraction).toHaveLength(g.cols * g.rows);
    expect([...g.walkableFraction].some((f) => f > 0)).toBe(true);
    expect([...g.walkableFraction].some((f) => f === 0)).toBe(true);
  });

  it("only marks ground near the street as walkable", () => {
    const g = grid();
    for (let i = 0; i < g.walkableFraction.length; i++) {
      if (g.walkableFraction[i] === 0) continue;
      // Street runs along y=0, 10 m wide, so any walkable cell's centre
      // must sit within half a cell of that band.
      expect(Math.abs(cellCenter(g, i).y)).toBeLessThanOrEqual(5 + g.cellSize / 2);
    }
  });

  it("attributes street cells to their corridor", () => {
    const g = grid();
    expect(g.corridorIdByCell.size).toBeGreaterThan(0);
    expect([...g.corridorIdByCell.values()].every((id) => id === "e1")).toBe(true);
  });
});

describe("countAgentsPerCell", () => {
  it("bins agents into the cell containing them and ignores out-of-bounds", () => {
    const g = grid();
    const cell = g.corridorIdByCell.keys().next().value as number;
    const here = cellCenter(g, cell);
    const counts = countAgentsPerCell(g, bodiesAt(here, here, { x: 1e6, y: 1e6 }));
    expect(counts[cell]).toBe(2);
    expect(counts.reduce((sum, n) => sum + n, 0)).toBe(2);
  });

  it("clears the reused buffer between samples", () => {
    const g = grid();
    const buffer = countAgentsPerCell(g, bodiesAt(cellCenter(g, g.corridorIdByCell.keys().next().value as number)));
    countAgentsPerCell(g, [], buffer);
    expect(buffer.reduce((sum, n) => sum + n, 0)).toBe(0);
  });
});

describe("cellDensity", () => {
  it("measures people against the cell's open ground, not its full area", () => {
    const g = grid();
    const cell = g.corridorIdByCell.keys().next().value as number;
    const counts = countAgentsPerCell(g, bodiesAt(cellCenter(g, cell)));
    const openArea = g.walkableFraction[cell] * g.cellSize * g.cellSize;
    expect(openArea).toBeLessThan(g.cellSize * g.cellSize);
    expect(cellDensity(g, counts, cell)).toBeCloseTo(1 / openArea);
  });

  it("is zero for a fully built-up cell", () => {
    const g = grid();
    const built = [...g.walkableFraction].findIndex((f) => f === 0);
    const counts = new Uint16Array(g.cols * g.rows);
    counts[built] = 5;
    expect(cellDensity(g, counts, built)).toBe(0);
  });
});
