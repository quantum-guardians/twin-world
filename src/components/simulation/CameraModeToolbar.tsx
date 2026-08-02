export type CameraMode = "overview" | "pov" | "free";

export interface CameraModeToolbarProps {
  mode: CameraMode;
  onSelectOverview: () => void;
  onSelectPov: () => void;
  onSelectFree: () => void;
  onNextAgent: () => void;
}

/** Three mutually exclusive ways to navigate the 3D scene: the fixed
 * overview (OrbitControls), an agent-attached first-person POV, and a
 * free-fly camera (WASD + drag-to-look). */
export function CameraModeToolbar({ mode, onSelectOverview, onSelectPov, onSelectFree, onNextAgent }: CameraModeToolbarProps) {
  return (
    <div className="pov-toolbar">
      <button
        type="button"
        className={mode === "overview" ? "toggle-button active" : "toggle-button"}
        onClick={onSelectOverview}
      >
        탑뷰
      </button>
      <button type="button" className={mode === "pov" ? "toggle-button active" : "toggle-button"} onClick={onSelectPov}>
        에이전트 시점
      </button>
      <button
        type="button"
        className={mode === "free" ? "toggle-button active" : "toggle-button"}
        onClick={onSelectFree}
      >
        자유 시점 (WASD)
      </button>
      {mode === "pov" && (
        <button type="button" className="toggle-button" onClick={onNextAgent}>
          다른 에이전트로 전환
        </button>
      )}
      {mode !== "overview" && (
        <span className="pov-toolbar-hint">
          {mode === "free" ? "WASD로 이동 · 드래그로 둘러보기" : "화면을 드래그하면 둘러볼 수 있습니다"}
        </span>
      )}
    </div>
  );
}
