import type { NodeKind, VenueNode } from "../../domain/types";

const KIND_OPTIONS: { value: NodeKind; label: string }[] = [
  { value: "normal", label: "일반" },
  { value: "entrance", label: "출입구" },
  { value: "exit", label: "출구" },
  { value: "destination", label: "목적지" },
];

export interface NodeInspectorProps {
  node: VenueNode;
  onChangeKind: (kind: NodeKind) => void;
  onChangeLabel: (label: string) => void;
  onDelete: () => void;
}

export function NodeInspector({ node, onChangeKind, onChangeLabel, onDelete }: NodeInspectorProps) {
  return (
    <div className="inspector-panel">
      <h3>노드 편집</h3>
      <label className="inspector-field">
        <span>이름</span>
        <input
          type="text"
          value={node.label ?? ""}
          onChange={(e) => onChangeLabel(e.target.value)}
        />
      </label>
      <label className="inspector-field">
        <span>유형</span>
        <select value={node.kind} onChange={(e) => onChangeKind(e.target.value as NodeKind)}>
          {KIND_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      <p className="inspector-meta">
        id: {node.id} · x: {Math.round(node.x)}, y: {Math.round(node.y)}
      </p>
      <button type="button" className="danger-button" onClick={onDelete}>
        노드 삭제
      </button>
    </div>
  );
}
