import type { Venue } from "./types";
import { applyOptimizedDirections } from "./venueGraph";
import { createFestivalStreetPreset } from "./festivalPreset";

/**
 * A recorded MR2S orientation for createFestivalStreetPreset(), so the demo
 * has a fixed optimized venue that does not depend on a live backend call.
 *
 * Two reasons this is recorded rather than fetched:
 *
 * 1. MR2S is not deterministic. It is a simulated-annealing pipeline, and
 *    eight calls with this exact graph returned eight different orientations
 *    with weighted APSP between 151,016 and 156,998 - a 4.0% spread. A demo
 *    that re-optimizes live shows a different number every time it is run.
 * 2. The GitHub Pages deploy is a static bundle with no /mr2s-api rewrite
 *    (see AGENTS.md), so a live call cannot work there at all.
 *
 * These pairs are the best of those eight runs, measured on 2026-09-07
 * against https://quantum.yunseong.dev/api/v1/mr2s:
 *
 *   weighted APSP (this orientation)  151,016
 *   optimized_graph_score                1,023   (the backend's own hop-count APSP)
 *   bidirectional_graph_score              704
 *
 * For scale, 200 random Robbins orientations of the same graph scored
 * between 176,191 and 229,350 weighted APSP, so this orientation is 14.4%
 * shorter than the best of them. Note that bidirectional_graph_score is the
 * same edges treated as undirected and is therefore always lower than any
 * one-way orientation - it is a floor, not a target to beat.
 *
 * "MR2S 일방통행 최적화" in the graph editor still calls the live backend;
 * this only supplies the pre-optimized venue the comparison demo starts from.
 */
export const FESTIVAL_PRESET_MR2S_PAIRS: Array<{ fromNodeId: string; toNodeId: string }> = [
  { fromNodeId: "n6", toNodeId: "n12" },
  { fromNodeId: "n4", toNodeId: "n3" },
  { fromNodeId: "n3", toNodeId: "n7" },
  { fromNodeId: "n5", toNodeId: "n4" },
  { fromNodeId: "n12", toNodeId: "n13" },
  { fromNodeId: "n9", toNodeId: "n2" },
  { fromNodeId: "n3", toNodeId: "n10" },
  { fromNodeId: "n1", toNodeId: "n9" },
  { fromNodeId: "n11", toNodeId: "n17" },
  { fromNodeId: "n13", toNodeId: "n8" },
  { fromNodeId: "n15", toNodeId: "n14" },
  { fromNodeId: "n14", toNodeId: "n9" },
  { fromNodeId: "n17", toNodeId: "n5" },
  { fromNodeId: "n4", toNodeId: "n11" },
  { fromNodeId: "n9", toNodeId: "n10" },
  { fromNodeId: "n1", toNodeId: "n2" },
  { fromNodeId: "n10", toNodeId: "n11" },
  { fromNodeId: "n6", toNodeId: "n1" },
  { fromNodeId: "n7", toNodeId: "n6" },
  { fromNodeId: "n8", toNodeId: "n4" },
  { fromNodeId: "n8", toNodeId: "n16" },
  { fromNodeId: "n2", toNodeId: "n3" },
  { fromNodeId: "n2", toNodeId: "n6" },
  { fromNodeId: "n11", toNodeId: "n15" },
  { fromNodeId: "n16", toNodeId: "n5" },
  { fromNodeId: "n7", toNodeId: "n8" },
];

/** The festival-street preset with the recorded MR2S orientation applied.
 * Every edge comes back one-way; the result is strongly connected, so all
 * three scenario modes stay routable. */
export function createFestivalStreetMr2sVenue(): Venue {
  const venue = createFestivalStreetPreset();
  return {
    ...applyOptimizedDirections(venue, FESTIVAL_PRESET_MR2S_PAIRS),
    id: "festival-street-preset-mr2s",
    name: "축제거리 (MR2S 최적화안)",
  };
}
