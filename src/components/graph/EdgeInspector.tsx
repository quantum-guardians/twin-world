import type { EdgeDirection, VenueEdge } from "../../domain/types";

const DIRECTION_OPTIONS: { value: EdgeDirection; label: string }[] = [
  { value: "bidirectional", label: "양방향" },
  { value: "forward", label: "정방향 (from → to)" },
  { value: "reverse", label: "역방향 (to → from)" },
];

export interface EdgeInspectorProps {
  edge: VenueEdge;
  lengthMeters: number;
  onChangeWidth: (width: number) => void;
  onChangeDirection: (direction: EdgeDirection) => void;
  onDelete: () => void;
}

export function EdgeInspector({
  edge,
  lengthMeters,
  onChangeWidth,
  onChangeDirection,
  onDelete,
}: EdgeInspectorProps) {
  return (
    <div className="inspector-panel">
      <h3>간선 편집</h3>
      <label className="inspector-field">
        <span>거리 폭 (m)</span>
        <input
          type="number"
          min={1}
          max={40}
          value={edge.width}
          onChange={(e) => onChangeWidth(Number(e.target.value))}
        />
      </label>
      <label className="inspector-field">
        <span>방향</span>
        <select value={edge.direction} onChange={(e) => onChangeDirection(e.target.value as EdgeDirection)}>
          {DIRECTION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      <p className="inspector-meta">
        id: {edge.id} · 길이: {lengthMeters.toFixed(1)}m
      </p>
      <button type="button" className="danger-button" onClick={onDelete}>
        간선 삭제
      </button>
    </div>
  );
}
