/**
 * Client for this app's own /api/scenario and /api/report endpoints (see
 * api/_lib/*.ts). Never talks to Upstage directly - the API key stays
 * server-side.
 */

export interface ScenarioResult {
  population: number;
  summary: string;
  warnings: string[];
}

export class UpstageRequestError extends Error {}

async function postJson<T>(url: string, payload: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const detail = await response
      .json()
      .then((d) => (typeof d?.error === "string" ? d.error : null))
      .catch(() => null);
    throw new UpstageRequestError(detail ?? `요청 실패 (${response.status})`);
  }
  return (await response.json()) as T;
}

export function structureScenario(description: string, defaultPopulation: number): Promise<ScenarioResult> {
  return postJson<ScenarioResult>("/api/scenario", { description, defaultPopulation });
}

export interface RunMetricsInput {
  arrivalRatePercent: number;
  evacuationP95Seconds: number | null;
  highPressureExposed: number;
  bottleneckCount: number;
}

export interface ReportRequest {
  venueName: string;
  nodeCount: number;
  edgeCount: number;
  population: number;
  baseline: RunMetricsInput;
  optimized: RunMetricsInput;
}

export interface ReportResult {
  summary: string;
  causes: { title: string; evidence: string }[];
  recommendations: { title: string; expectedEffect: string }[];
  limitations: string[];
}

export function generateReport(request: ReportRequest): Promise<ReportResult> {
  return postJson<ReportResult>("/api/report", request);
}
