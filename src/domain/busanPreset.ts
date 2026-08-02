import type { Venue } from "./types";

/**
 * Illustrative festival-street layout inspired by typical Busan festival/
 * performance streets (a wide central promenade widening into a plaza in
 * front of the stage, flanked by two narrower side alleys that loop back
 * into the main street). Coordinates are NOT surveyed GIS data — no real
 * map or scale was available during MVP recon (see
 * .plan/general/2026-08-02-twin-world-mvp-planning.md, Open Questions
 * 1-3). `isSyntheticLayout` must stay true so the UI and AI report can
 * disclose this limitation instead of presenting it as a real site.
 *
 * The west/east alleys exist so MR2S has more than one path to choose
 * between when it proposes one-way directions - a single-corridor graph
 * gives the optimizer nothing to optimize.
 */
export function createBusanFestivalStreetPreset(): Venue {
  return {
    id: "busan-festival-street-preset",
    name: "부산 축제거리 (가상 프리셋)",
    region: "부산",
    scaleMetersPerUnit: 1,
    isSyntheticLayout: true,
    nodes: [
      { id: "n1", x: 300, y: 0, kind: "entrance", label: "북문 입구" },
      { id: "n2", x: 300, y: 120, kind: "normal", label: "북측 교차로" },
      { id: "n3", x: 300, y: 240, kind: "destination", label: "무대 광장" },
      { id: "n4", x: 300, y: 360, kind: "normal", label: "남측 교차로" },
      { id: "n5", x: 300, y: 480, kind: "exit", label: "남문 출구" },
      { id: "n6", x: 150, y: 120, kind: "normal", label: "서측 골목 상단" },
      { id: "n7", x: 150, y: 360, kind: "normal", label: "서측 골목 하단" },
      { id: "n8", x: 30, y: 240, kind: "entrance", label: "서문 입구" },
      { id: "n9", x: 450, y: 120, kind: "normal", label: "동측 골목 상단" },
      { id: "n10", x: 450, y: 360, kind: "normal", label: "동측 골목 하단" },
      { id: "n11", x: 570, y: 240, kind: "exit", label: "동문 출구" },
    ],
    edges: [
      { id: "e1", fromNodeId: "n1", toNodeId: "n2", width: 12, direction: "bidirectional" },
      { id: "e2", fromNodeId: "n2", toNodeId: "n3", width: 16, direction: "bidirectional" },
      { id: "e3", fromNodeId: "n3", toNodeId: "n4", width: 16, direction: "bidirectional" },
      { id: "e4", fromNodeId: "n4", toNodeId: "n5", width: 12, direction: "bidirectional" },
      { id: "e5", fromNodeId: "n2", toNodeId: "n6", width: 6, direction: "bidirectional" },
      { id: "e6", fromNodeId: "n6", toNodeId: "n7", width: 6, direction: "bidirectional" },
      { id: "e7", fromNodeId: "n7", toNodeId: "n4", width: 6, direction: "bidirectional" },
      { id: "e8", fromNodeId: "n8", toNodeId: "n6", width: 8, direction: "bidirectional" },
      { id: "e9", fromNodeId: "n8", toNodeId: "n7", width: 8, direction: "bidirectional" },
      { id: "e10", fromNodeId: "n2", toNodeId: "n9", width: 6, direction: "bidirectional" },
      { id: "e11", fromNodeId: "n9", toNodeId: "n10", width: 6, direction: "bidirectional" },
      { id: "e12", fromNodeId: "n10", toNodeId: "n4", width: 6, direction: "bidirectional" },
      { id: "e13", fromNodeId: "n11", toNodeId: "n9", width: 8, direction: "bidirectional" },
      { id: "e14", fromNodeId: "n11", toNodeId: "n10", width: 8, direction: "bidirectional" },
    ],
  };
}
