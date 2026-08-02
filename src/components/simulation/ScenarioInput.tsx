import { useState } from "react";
import { structureScenario } from "../../api/upstageClient";

export interface ScenarioInputProps {
  defaultPopulation: number;
  onApplyPopulation: (population: number) => void;
}

/**
 * AI role 1 (plan: "자연어 시나리오 구조화"). The model only ever proposes a
 * population number; the user must click "적용" to actually change the
 * simulation - matching the plan's safety principle that AI output is
 * confirmed before use, not applied automatically (FR-10).
 */
export function ScenarioInput({ defaultPopulation, onApplyPopulation }: ScenarioInputProps) {
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ summary: string; warnings: string[]; population: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleStructure = async () => {
    if (!description.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await structureScenario(description, defaultPopulation);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="scenario-input">
      <textarea
        className="scenario-textarea"
        placeholder="예: 18시부터 3,000명이 북쪽 입구로 유입되고 공연 종료 후 남쪽 출구로 이동한다."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
      />
      <button
        type="button"
        className="toggle-button"
        onClick={handleStructure}
        disabled={loading || !description.trim()}
      >
        {loading ? "AI 구조화 중..." : "AI로 인원수 구조화"}
      </button>
      {result && (
        <div className="scenario-result">
          <p>
            {result.summary} (인원 {result.population}명)
          </p>
          {result.warnings.map((w, i) => (
            <p key={i} className="scenario-warning">
              {w}
            </p>
          ))}
          <button type="button" className="toggle-button" onClick={() => onApplyPopulation(result.population)}>
            이 인원수 적용
          </button>
        </div>
      )}
      {error && <p className="graph-toolbar-error">{error}</p>}
    </div>
  );
}
