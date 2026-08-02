/**
 * Client for mr2s-backend's V1 optimization API (see docs/BACKEND_REFERENCE.md).
 * Deployed at https://quantum.yunseong.dev; its CORS allowlist only covers
 * its own deployed frontend origins, not this app's dev/preview origins,
 * so requests go through the "/mr2s-api" proxy configured in
 * vite.config.ts (dev) / the equivalent rewrite at deploy time, matching
 * the pattern already proven in the sibling simulation_react project.
 */

export interface Mr2sEdgeInput {
  vertices: [number, number];
  weight: number;
}

export interface Mr2sRequest {
  edges: Mr2sEdgeInput[];
}

export interface Mr2sResponseEdge {
  _from: number;
  to: number;
}

export interface Mr2sResponse {
  edges: Mr2sResponseEdge[];
  /** APSP sum of the optimized directed graph; -1 if it isn't strongly connected. */
  optimized_graph_score: number;
  /** APSP sum treating the same edges as undirected, for comparison. */
  bidirectional_graph_score: number;
}

export class Mr2sTimeoutError extends Error {
  constructor() {
    super("MR2S 최적화 요청이 10초 내에 완료되지 않았습니다. 그래프 규모를 줄이고 다시 시도하세요.");
    this.name = "Mr2sTimeoutError";
  }
}

export class Mr2sApiError extends Error {
  readonly status: number;
  constructor(status: number, detail: string) {
    super(`MR2S 요청 실패 (${status}): ${detail}`);
    this.name = "Mr2sApiError";
    this.status = status;
  }
}

const MR2S_ENDPOINT = "/mr2s-api/api/v1/mr2s";

export async function optimizeMr2s(request: Mr2sRequest): Promise<Mr2sResponse> {
  let response: Response;
  try {
    response = await fetch(MR2S_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  } catch (err) {
    throw new Mr2sApiError(0, err instanceof Error ? err.message : "네트워크 오류");
  }

  if (response.status === 408) throw new Mr2sTimeoutError();
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Mr2sApiError(response.status, detail || response.statusText);
  }
  return (await response.json()) as Mr2sResponse;
}
