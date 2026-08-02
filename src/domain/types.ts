export type NodeKind = "normal" | "entrance" | "exit" | "destination";

export type EdgeDirection = "bidirectional" | "forward" | "reverse";

export interface VenueNode {
  id: string;
  x: number;
  y: number;
  kind: NodeKind;
  label?: string;
}

/**
 * `direction` is relative to `fromNodeId -> toNodeId`: "forward" means only
 * that direction is walkable, "reverse" only the opposite, "bidirectional"
 * both. MR2S optimization results are applied by rewriting this field, not
 * by mutating fromNodeId/toNodeId, so the original edge id and endpoints
 * stay stable across baseline/optimized comparisons.
 */
export interface VenueEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  width: number;
  direction: EdgeDirection;
}

export interface Venue {
  id: string;
  name: string;
  region: string;
  /** Real-world meters represented by one coordinate unit. 1 = coordinates are already meters. */
  scaleMetersPerUnit: number;
  /** True when node coordinates are an illustrative layout rather than surveyed/GIS data. */
  isSyntheticLayout: boolean;
  nodes: VenueNode[];
  edges: VenueEdge[];
}
