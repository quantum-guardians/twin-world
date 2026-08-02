import type { AgentPovSelection } from "../../simulation/useAgentPovSelection";

export interface PovToolbarProps {
  pov: AgentPovSelection;
}

/** Toggle bar for "에이전트 시점" (first-person agent POV) mode. */
export function PovToolbar({ pov }: PovToolbarProps) {
  return (
    <div className="pov-toolbar">
      {!pov.agentId ? (
        <button type="button" className="toggle-button" onClick={pov.start}>
          에이전트 시점 체험
        </button>
      ) : (
        <>
          <span className="pov-toolbar-label">에이전트 시점으로 보는 중</span>
          <button type="button" className="toggle-button" onClick={pov.next}>
            다른 에이전트로 전환
          </button>
          <button type="button" className="toggle-button active" onClick={pov.stop}>
            탑뷰로 복귀
          </button>
        </>
      )}
    </div>
  );
}
