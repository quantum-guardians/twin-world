export interface VenuePickerProps {
  onSelectPreset: () => void;
  onStartBlank: () => void;
}

export function VenuePicker({ onSelectPreset, onStartBlank }: VenuePickerProps) {
  return (
    <div className="venue-picker">
      <h2>프로젝트 / 장소 선택</h2>
      <div className="venue-picker-options">
        <button type="button" className="venue-picker-card" onClick={onSelectPreset}>
          <strong>부산 축제거리 프리셋</strong>
          <span>가상 레이아웃 · 실측 좌표 아님 · 데모용 기본 시나리오</span>
        </button>
        <button type="button" className="venue-picker-card" onClick={onStartBlank}>
          <strong>새 그래프 시작</strong>
          <span>빈 캔버스에서 직접 노드·간선을 그려 시작</span>
        </button>
      </div>
    </div>
  );
}
