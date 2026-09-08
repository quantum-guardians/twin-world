import { describe, expect, it } from "vitest";
import { createFestivalStreetPreset } from "./festivalPreset";
import { createFestivalStreetMr2sVenue, FESTIVAL_PRESET_MR2S_PAIRS } from "./festivalPresetMr2s";
import { directedApspSum, robbinsOrientation } from "./robbinsOrientation";
import { nodesOfKind, reachableNodeIds } from "./venueGraph";

/** The recorded orientation is demo data, not code, so these tests check the
 * properties the demo depends on rather than the individual pairs: it covers
 * every edge, it leaves the graph strongly connected, and it beats the
 * Robbins baseline it is supposed to beat. */
describe("festival preset MR2S snapshot", () => {
  const preset = createFestivalStreetPreset();
  const venue = createFestivalStreetMr2sVenue();

  it("records exactly one direction for every preset edge", () => {
    expect(FESTIVAL_PRESET_MR2S_PAIRS).toHaveLength(preset.edges.length);
    const seen = new Set(FESTIVAL_PRESET_MR2S_PAIRS.map((p) => [p.fromNodeId, p.toNodeId].sort().join("-")));
    expect(seen.size).toBe(preset.edges.length);
  });

  it("leaves no edge bidirectional", () => {
    expect(venue.edges.every((e) => e.direction === "forward" || e.direction === "reverse")).toBe(true);
  });

  it("keeps edge ids and endpoints identical to the preset", () => {
    expect(venue.edges.map((e) => [e.id, e.fromNodeId, e.toNodeId])).toEqual(
      preset.edges.map((e) => [e.id, e.fromNodeId, e.toNodeId])
    );
  });

  it("is strongly connected", () => {
    for (const node of venue.nodes) {
      expect(reachableNodeIds(venue, node.id).size).toBe(venue.nodes.length);
    }
    expect(directedApspSum(venue)).not.toBeNull();
  });

  it("keeps every scenario mode routable", () => {
    const entrances = nodesOfKind(venue, "entrance");
    const destinations = nodesOfKind(venue, "destination");
    const exits = nodesOfKind(venue, "exit");
    expect(entrances.length).toBeGreaterThan(0);
    expect(destinations.length).toBeGreaterThan(0);
    expect(exits.length).toBeGreaterThan(0);

    for (const start of [...entrances, ...destinations]) {
      const reachable = reachableNodeIds(venue, start.id);
      for (const exit of exits) expect(reachable.has(exit.id)).toBe(true);
    }
    for (const entrance of entrances) {
      const reachable = reachableNodeIds(venue, entrance.id);
      for (const destination of destinations) expect(reachable.has(destination.id)).toBe(true);
    }
  });

  it("beats every Robbins orientation it is compared against", () => {
    const mr2s = directedApspSum(venue);
    expect(mr2s).not.toBeNull();
    for (let seed = 1; seed <= 40; seed++) {
      const robbins = directedApspSum(robbinsOrientation(preset, seed));
      if (robbins === null) continue;
      expect(robbins).toBeGreaterThan(mr2s!);
    }
  });
});
