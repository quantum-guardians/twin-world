export interface VenuePickerProps {
  onSelectFestivalPreset: () => void;
  onSelectBusanPreset: () => void;
  onStartBlank: () => void;
}

export function VenuePicker({
  onSelectFestivalPreset,
  onSelectBusanPreset,
  onStartBlank,
}: VenuePickerProps) {
  return (
    <div className="venue-picker">
      <h2>프로젝트 / 장소 선택</h2>
      <div className="venue-picker-options">
        <button type="button" className="venue-picker-card" onClick={onSelectFestivalPreset}>
          <strong>축제거리 프리셋</strong>
          <span>가상 레이아웃 · 실측 좌표 아님 · MR2S 비교 데모 기본값</span>
        </button>
        <button type="button" className="venue-picker-card" onClick={onSelectBusanPreset}>
          <strong>부산 축제거리 프리셋 (구버전)</strong>
          <span>이 그래프는 bridge를 포함하고 있어 MR2S가 strongly connected orientation을 만들 수 없습니다</span>
        </button>
        <button type="button" className="venue-picker-card" onClick={onStartBlank}>
          <strong>새 그래프 시작</strong>
          <span>빈 캔버스에서 직접 노드·간선을 그려 시작</span>
        </button>
      </div>
    </div>
  );
}
