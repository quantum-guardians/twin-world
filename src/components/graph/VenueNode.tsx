import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { NodeKind } from "../../domain/types";
import { KIND_COLOR, KIND_LABEL } from "../../domain/nodeColors";

export interface VenueNodeData {
  kind: NodeKind;
  label: string;
  selected: boolean;
  [key: string]: unknown;
}

type VenueFlowNode = Node<VenueNodeData, "venueNode">;

// Small discrete connection points on all four edges (each carrying both a
// source and a target handle) rather than one handle stretched over the
// whole node. A full-node handle sits in the same DOM position as xyflow's
// own node-drag listener and wins/loses that pointerdown race
// unpredictably, so drag-to-move and drag-to-connect fight each other
// (confirmed against this exact node shape: connections silently failed to
// register). This is the same discrete-handle layout used successfully in
// the sibling mr2s-frontend project's CircleNode.
const HANDLE_POSITIONS = [
  { id: "top", pos: Position.Top, style: { left: "50%", top: 0, transform: "translate(-50%, -50%)" } },
  { id: "right", pos: Position.Right, style: { left: "100%", top: "50%", transform: "translate(-50%, -50%)" } },
  { id: "bottom", pos: Position.Bottom, style: { left: "50%", top: "100%", transform: "translate(-50%, -50%)" } },
  { id: "left", pos: Position.Left, style: { left: 0, top: "50%", transform: "translate(-50%, -50%)" } },
] as const;

export function VenueNode({ data }: NodeProps<VenueFlowNode>) {
  const color = KIND_COLOR[data.kind];
  return (
    <div
      className="venue-node"
      style={{
        borderColor: color,
        boxShadow: data.selected ? `0 0 0 3px ${color}55` : "none",
      }}
      title={`${data.label} (${KIND_LABEL[data.kind]})`}
    >
      {HANDLE_POSITIONS.map((h) => (
        <Handle
          key={`s-${h.id}`}
          type="source"
          id={`${h.id}-src`}
          position={h.pos}
          className="venue-node-handle-point"
          style={h.style}
        />
      ))}
      {HANDLE_POSITIONS.map((h) => (
        <Handle
          key={`t-${h.id}`}
          type="target"
          id={`${h.id}-tgt`}
          position={h.pos}
          className="venue-node-handle-point"
          style={h.style}
        />
      ))}
      <span className="venue-node-dot" style={{ background: color }} />
      <span className="venue-node-label">{data.label}</span>
    </div>
  );
}

export const venueNodeTypes = { venueNode: VenueNode };
