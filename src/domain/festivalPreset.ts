import type { Venue } from "./types";

/**
 * Festival-street layout built around a central promenade: north entrance
 * (n1) down through the north crossing (n2), the stage plaza (n3), the south
 * crossing (n4), to the south exit (n5). Two side alleys (west: n6-n7-n8,
 * east: n9-n10-n11) run parallel to the promenade and cross-connect into it
 * at n2/n3/n4, forming rings around the plaza instead of a single spine. A
 * perimeter loop (n12-n13-n8-n16-n5-n17-n11-n15-n14-n9-n6, closed back
 * through n1) threads every gate - the two extra west/east entrances (n12,
 * n14) and the two southern exits (n16, n17) - onto the same connected mesh
 * as the promenade and the alleys.
 *
 * The alley spines (e7 n6-n7, e8 n7-n8, e9 n9-n10, e10 n10-n11) are
 * deliberately narrow at 6 m: they are meant to bottleneck under counterflow
 * so the crowd simulation has somewhere for congestion to actually show up,
 * instead of every path being generously wide.
 *
 * Critically, every node here sits on at least one cycle, so the graph has
 * no bridge (no 2-edge-connectivity violation) - unlike `busanPreset.ts`,
 * where n1 and n5 hang off the graph by a single edge each. A bridgeless
 * graph is exactly the condition Robbins' theorem requires for a strongly
 * connected orientation to exist at all, which is what lets the deployed
 * MR2S backend return a real `optimized_graph_score` here instead of the -1
 * it always returns for a graph with a bridge. That, in turn, is what
 * guarantees every entrance keeps at least one outgoing edge and every exit
 * keeps at least one incoming edge under whatever one-way orientation MR2S
 * picks - the property `busanPreset.ts` cannot offer, since orienting either
 * of its bridge edges necessarily cuts off n1 or n5 in one direction.
 *
 * Coordinates are NOT surveyed GIS data - this is an illustrative layout, not
 * a real site. `isSyntheticLayout` must stay true so the UI and AI report
 * keep disclosing that instead of presenting it as a real venue.
 */
export function createFestivalStreetPreset(): Venue {
  return {
    id: "festival-street-preset",
    name: "축제거리 (가상 프리셋)",
    region: "부산",
    scaleMetersPerUnit: 1,
    isSyntheticLayout: true,
    nodes: [
      { id: "n1", x: 300, y: 0, kind: "entrance", label: "북문 입구" },
      { id: "n2", x: 300, y: 110, kind: "normal", label: "북측 교차로" },
      { id: "n3", x: 300, y: 230, kind: "destination", label: "무대 광장" },
      { id: "n4", x: 300, y: 350, kind: "normal", label: "남측 교차로" },
      { id: "n5", x: 300, y: 460, kind: "exit", label: "남문 출구" },
      { id: "n6", x: 160, y: 60, kind: "normal", label: "서측 골목 상단" },
      { id: "n7", x: 160, y: 230, kind: "normal", label: "서측 골목 중단" },
      { id: "n8", x: 160, y: 400, kind: "normal", label: "서측 골목 하단" },
      { id: "n9", x: 440, y: 60, kind: "normal", label: "동측 골목 상단" },
      { id: "n10", x: 440, y: 230, kind: "normal", label: "동측 골목 중단" },
      { id: "n11", x: 440, y: 400, kind: "normal", label: "동측 골목 하단" },
      { id: "n12", x: 40, y: 140, kind: "entrance", label: "서문 입구" },
      { id: "n13", x: 40, y: 340, kind: "normal", label: "서측 외곽" },
      { id: "n14", x: 560, y: 140, kind: "entrance", label: "동문 입구" },
      { id: "n15", x: 560, y: 340, kind: "normal", label: "동측 외곽" },
      { id: "n16", x: 160, y: 530, kind: "exit", label: "남서 출구" },
      { id: "n17", x: 440, y: 530, kind: "exit", label: "남동 출구" },
    ],
    edges: [
      { id: "e1", fromNodeId: "n1", toNodeId: "n2", width: 14, direction: "bidirectional" },
      { id: "e2", fromNodeId: "n2", toNodeId: "n3", width: 18, direction: "bidirectional" },
      { id: "e3", fromNodeId: "n3", toNodeId: "n4", width: 18, direction: "bidirectional" },
      { id: "e4", fromNodeId: "n4", toNodeId: "n5", width: 14, direction: "bidirectional" },
      { id: "e5", fromNodeId: "n1", toNodeId: "n6", width: 8, direction: "bidirectional" },
      { id: "e6", fromNodeId: "n1", toNodeId: "n9", width: 8, direction: "bidirectional" },
      { id: "e7", fromNodeId: "n6", toNodeId: "n7", width: 6, direction: "bidirectional" },
      { id: "e8", fromNodeId: "n7", toNodeId: "n8", width: 6, direction: "bidirectional" },
      { id: "e9", fromNodeId: "n9", toNodeId: "n10", width: 6, direction: "bidirectional" },
      { id: "e10", fromNodeId: "n10", toNodeId: "n11", width: 6, direction: "bidirectional" },
      { id: "e11", fromNodeId: "n2", toNodeId: "n6", width: 7, direction: "bidirectional" },
      { id: "e12", fromNodeId: "n2", toNodeId: "n9", width: 7, direction: "bidirectional" },
      { id: "e13", fromNodeId: "n3", toNodeId: "n7", width: 9, direction: "bidirectional" },
      { id: "e14", fromNodeId: "n3", toNodeId: "n10", width: 9, direction: "bidirectional" },
      { id: "e15", fromNodeId: "n4", toNodeId: "n8", width: 7, direction: "bidirectional" },
      { id: "e16", fromNodeId: "n4", toNodeId: "n11", width: 7, direction: "bidirectional" },
      { id: "e17", fromNodeId: "n6", toNodeId: "n12", width: 8, direction: "bidirectional" },
      { id: "e18", fromNodeId: "n12", toNodeId: "n13", width: 8, direction: "bidirectional" },
      { id: "e19", fromNodeId: "n13", toNodeId: "n8", width: 8, direction: "bidirectional" },
      { id: "e20", fromNodeId: "n9", toNodeId: "n14", width: 8, direction: "bidirectional" },
      { id: "e21", fromNodeId: "n14", toNodeId: "n15", width: 8, direction: "bidirectional" },
      { id: "e22", fromNodeId: "n15", toNodeId: "n11", width: 8, direction: "bidirectional" },
      { id: "e23", fromNodeId: "n8", toNodeId: "n16", width: 8, direction: "bidirectional" },
      { id: "e24", fromNodeId: "n16", toNodeId: "n5", width: 10, direction: "bidirectional" },
      { id: "e25", fromNodeId: "n5", toNodeId: "n17", width: 10, direction: "bidirectional" },
      { id: "e26", fromNodeId: "n17", toNodeId: "n11", width: 8, direction: "bidirectional" },
    ],
  };
}
