import { callUpstageJson, UpstageApiError, UpstageConfigError } from "./upstage.js";
import type { HandlerResult } from "./scenarioHandler.js";

export interface RunMetricsInput {
  arrivalRatePercent: number;
  evacuationP95Seconds: number | null;
  highPressureExposed: number;
  bottleneckCount: number;
}

export interface ReportRequestBody {
  venueName: string;
  nodeCount: number;
  edgeCount: number;
  population: number;
  baseline: RunMetricsInput;
  optimized: RunMetricsInput;
}

export interface ReportCause {
  title: string;
  evidence: string;
}

export interface ReportRecommendation {
  title: string;
  expectedEffect: string;
}

export interface ReportResult {
  summary: string;
  causes: ReportCause[];
  recommendations: ReportRecommendation[];
  limitations: string[];
}

function isValidMetrics(m: unknown): m is RunMetricsInput {
  if (!m || typeof m !== "object") return false;
  const r = m as Record<string, unknown>;
  return (
    typeof r.arrivalRatePercent === "number" &&
    (r.evacuationP95Seconds === null || typeof r.evacuationP95Seconds === "number") &&
    typeof r.highPressureExposed === "number" &&
    typeof r.bottleneckCount === "number"
  );
}

/**
 * AI roles 2-4 (plan: 위험 원인 분석 / 개선안 추천 / 분석 보고서), combined
 * into one call since they consume the same baseline-vs-optimized metrics
 * and naturally form one document. Safety principles from the plan are
 * enforced in the prompt: only reason from the metrics actually given (no
 * invented casualty counts or facts), and recommendations are candidates
 * for a manager to review, not auto-applied changes.
 */
export async function handleReportRequest(body: unknown): Promise<HandlerResult> {
  const request = body as Partial<ReportRequestBody> | null;
  if (
    !request ||
    typeof request.venueName !== "string" ||
    !isValidMetrics(request.baseline) ||
    !isValidMetrics(request.optimized)
  ) {
    return { status: 400, body: { error: "venueName, baseline, and optimized metrics are required" } };
  }

  const payload = {
    venue: { name: request.venueName, nodeCount: request.nodeCount, edgeCount: request.edgeCount },
    population: request.population,
    baseline: request.baseline,
    optimized: request.optimized,
  };

  const messages = [
    {
      role: "system" as const,
      content:
        "당신은 다중밀집 사고 위험 분석가입니다. 아래에 주어진 시뮬레이션 지표만 근거로 분석하세요. " +
        "지표에 없는 사실, 실제 사상자 수, 확정적인 안전 판정을 만들어내지 마세요 - 압력 노출은 " +
        "상대적 위험 지표이지 실제 인명 피해 예측이 아닙니다. 개선안은 관리자가 검토할 후보이며 " +
        "자동으로 적용되는 것이 아님을 분명히 하세요. 반드시 다음 키만 가진 JSON 객체로만 응답하세요: " +
        '{"summary": string, "causes": [{"title": string, "evidence": string}], ' +
        '"recommendations": [{"title": string, "expectedEffect": string}], "limitations": [string]}. ' +
        "모든 텍스트는 한국어로 작성하세요.",
    },
    { role: "user" as const, content: JSON.stringify(payload) },
  ];

  let parsed: unknown;
  try {
    parsed = await callUpstageJson(messages);
  } catch (err) {
    if (err instanceof UpstageConfigError) return { status: 500, body: { error: err.message } };
    if (err instanceof UpstageApiError) return { status: 502, body: { error: err.message } };
    return { status: 502, body: { error: err instanceof Error ? err.message : String(err) } };
  }

  const record = (parsed ?? {}) as Record<string, unknown>;
  const result: ReportResult = {
    summary: typeof record.summary === "string" ? record.summary : "",
    causes: Array.isArray(record.causes)
      ? (record.causes as unknown[]).filter(
          (c): c is ReportCause =>
            !!c && typeof c === "object" && typeof (c as ReportCause).title === "string"
        )
      : [],
    recommendations: Array.isArray(record.recommendations)
      ? (record.recommendations as unknown[]).filter(
          (r): r is ReportRecommendation =>
            !!r && typeof r === "object" && typeof (r as ReportRecommendation).title === "string"
        )
      : [],
    limitations: Array.isArray(record.limitations) ? (record.limitations as unknown[]).filter((l) => typeof l === "string") : [],
  };

  return { status: 200, body: result };
}
