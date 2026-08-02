import { useState } from "react";
import type { Venue } from "../../domain/types";
import type { VenueSimulation } from "../../simulation/engine";
import { generateReport, type ReportResult } from "../../api/upstageClient";

export interface ReportPanelProps {
  venue: Venue;
  population: number;
  baseline: VenueSimulation;
  optimized: VenueSimulation;
}

function toRunMetrics(sim: VenueSimulation) {
  const m = sim.metrics();
  return {
    arrivalRatePercent: m.arrivalRatePercent,
    evacuationP95Seconds: m.evacuationP95Seconds,
    highPressureExposed: m.highPressureExposed,
    bottleneckCount: sim.bottleneckCorridorIds.size,
  };
}

function reportToMarkdown(venueName: string, report: ReportResult): string {
  const lines = [
    `# ${venueName} - AI 분석 보고서`,
    "",
    report.summary,
    "",
    "## 주요 원인",
    ...report.causes.flatMap((c) => [`- **${c.title}**: ${c.evidence}`]),
    "",
    "## 권고안 (관리자 검토 필요)",
    ...report.recommendations.flatMap((r) => [`- **${r.title}**: ${r.expectedEffect}`]),
    "",
    "## 가정 및 한계",
    ...report.limitations.map((l) => `- ${l}`),
  ];
  return lines.join("\n");
}

/** AI roles 2-4 (plan: 위험 원인 분석 / 개선안 추천 / 분석 보고서). Reads
 * whichever metrics the two live simulations currently have - the report
 * is a snapshot of "right now", not tied to a particular run being
 * finished, since a manager may want an early read before evacuation
 * completes. */
export function ReportPanel({ venue, population, baseline, optimized }: ReportPanelProps) {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ReportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await generateReport({
        venueName: venue.name,
        nodeCount: venue.nodes.length,
        edgeCount: venue.edges.length,
        population,
        baseline: toRunMetrics(baseline),
        optimized: toRunMetrics(optimized),
      });
      setReport(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!report) return;
    const markdown = reportToMarkdown(venue.name, report);
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${venue.id}-report.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="report-panel">
      <div className="report-panel-actions">
        <button type="button" className="toggle-button" onClick={handleGenerate} disabled={loading}>
          {loading ? "AI 보고서 생성 중..." : "AI 분석 보고서 생성"}
        </button>
        {report && (
          <button type="button" className="toggle-button" onClick={handleDownload}>
            Markdown 내보내기
          </button>
        )}
      </div>
      {error && <p className="graph-toolbar-error">{error}</p>}
      {report && (
        <div className="report-body">
          <p>{report.summary}</p>
          {report.causes.length > 0 && (
            <>
              <h4>주요 원인</h4>
              <ul>
                {report.causes.map((c, i) => (
                  <li key={i}>
                    <strong>{c.title}</strong>: {c.evidence}
                  </li>
                ))}
              </ul>
            </>
          )}
          {report.recommendations.length > 0 && (
            <>
              <h4>권고안 (관리자 검토 필요)</h4>
              <ul>
                {report.recommendations.map((r, i) => (
                  <li key={i}>
                    <strong>{r.title}</strong>: {r.expectedEffect}
                  </li>
                ))}
              </ul>
            </>
          )}
          {report.limitations.length > 0 && (
            <>
              <h4>가정 및 한계</h4>
              <ul>
                {report.limitations.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
