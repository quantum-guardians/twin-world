import { MarkerType, type Edge as FlowEdge, type Node as FlowNode } from "@xyflow/react";
import type { EdgeDirection, NodeKind, Venue } from "../domain/types";
import type { VenueNodeData } from "../components/graph/VenueNode";

export interface VenueEdgeData {
  width: number;
  direction: EdgeDirection;
  [key: string]: unknown;
}

export type VenueFlowNode = FlowNode<VenueNodeData, "venueNode">;
export type VenueFlowEdge = FlowEdge<VenueEdgeData>;

/** One-time conversion used only to seed local xyflow state on mount.
 * After that, editing flows through xyflow's own node/edge state so
 * measured dimensions survive drags (see VenueGraphEditor). */
export function initialFlowNodes(venue: Venue): VenueFlowNode[] {
  return venue.nodes.map((n) => ({
    id: n.id,
    type: "venueNode",
    position: { x: n.x, y: n.y },
    data: { kind: n.kind, label: n.label ?? n.id, selected: false },
  }));
}

export function initialFlowEdges(venue: Venue): VenueFlowEdge[] {
  return venue.edges.map((e) => ({
    id: e.id,
    source: e.fromNodeId,
    target: e.toNodeId,
    data: { width: e.width, direction: e.direction },
  }));
}

const ARROW = { type: MarkerType.ArrowClosed, width: 16, height: 16 };

/** VenueNode renders one source+target handle pair at each of these 4
 * perimeter points (see VenueNode.tsx). An edge with no sourceHandle/
 * targetHandle is ambiguous once a node has more than one handle of the
 * same type, which made xyflow render wildly oversized arrow markers
 * instead of a normal line - so every edge must pin an explicit pair,
 * chosen by which side of each node faces the other node. Recomputed at
 * render time (not baked in once) so edges stay clean after a node drag,
 * following the same angle-bucket approach as the sibling mr2s-frontend
 * project's GraphVisualization.tsx (4 directions here instead of its 8,
 * since VenueNode only has top/right/bottom/left).
 */
function pickHandleSide(dx: number, dy: number): "top" | "right" | "bottom" | "left" {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "right" : "left";
  return dy >= 0 ? "bottom" : "top";
}

const OPPOSITE_SIDE = { top: "bottom", bottom: "top", left: "right", right: "left" } as const;

/** Adds render-only presentation (label, stroke, markers, selection glow,
 * geometric handle assignment) on top of the stored node/edge data
 * without touching the state arrays xyflow manages, so measured
 * dimensions are never dropped. */
export function decorateNodesForRender(
  nodes: VenueFlowNode[],
  selectedNodeId: string | null
): VenueFlowNode[] {
  return nodes.map((n) => ({ ...n, data: { ...n.data, selected: n.id === selectedNodeId } }));
}

export function decorateEdgesForRender(
  nodes: VenueFlowNode[],
  edges: VenueFlowEdge[],
  selectedEdgeId: string | null
): VenueFlowEdge[] {
  const positionById = new Map(nodes.map((n) => [n.id, n.position]));
  return edges.map((e) => {
    const selected = e.id === selectedEdgeId;
    const { width, direction } = e.data!;
    const from = positionById.get(e.source);
    const to = positionById.get(e.target);
    const dx = (to?.x ?? 0) - (from?.x ?? 0);
    const dy = (to?.y ?? 0) - (from?.y ?? 0);
    const sourceSide = pickHandleSide(dx, dy);
    return {
      ...e,
      sourceHandle: `${sourceSide}-src`,
      targetHandle: `${OPPOSITE_SIDE[sourceSide]}-tgt`,
      label: `${width}m`,
      style: {
        strokeWidth: Math.max(2, Math.min(width / 2, 10)),
        // Selection accent matches the app's --accent; the resting stroke is
        // the mid ink used for secondary text on the light canvas.
        stroke: selected ? "#2450d8" : "#6b7480",
      },
      markerEnd: direction === "forward" || direction === "bidirectional" ? ARROW : undefined,
      markerStart: direction === "reverse" || direction === "bidirectional" ? ARROW : undefined,
    };
  });
}

/** Reconstructs an immutable Venue snapshot from live xyflow state, for
 * exporting/lifting state up. Node kind defaults defensively to "normal"
 * if data is ever missing a kind (should not happen in practice). */
export function deriveVenue(base: Venue, nodes: VenueFlowNode[], edges: VenueFlowEdge[]): Venue {
  return {
    ...base,
    nodes: nodes.map((n) => ({
      id: n.id,
      x: n.position.x,
      y: n.position.y,
      kind: (n.data.kind as NodeKind) ?? "normal",
      label: n.data.label,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      fromNodeId: e.source,
      toNodeId: e.target,
      width: e.data?.width ?? 8,
      direction: e.data?.direction ?? "bidirectional",
    })),
  };
}
