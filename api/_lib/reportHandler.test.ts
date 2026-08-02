import { afterEach, describe, expect, it, vi } from "vitest";
import * as upstage from "./upstage.js";
import { handleReportRequest, type RunMetricsInput } from "./reportHandler.js";

const validMetrics: RunMetricsInput = {
  arrivalRatePercent: 80,
  evacuationP95Seconds: 120,
  highPressureExposed: 2,
  bottleneckCount: 1,
};

const validBody = {
  venueName: "부산 축제거리",
  nodeCount: 11,
  edgeCount: 14,
  population: 150,
  baseline: validMetrics,
  optimized: { ...validMetrics, arrivalRatePercent: 92, bottleneckCount: 0 },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("handleReportRequest", () => {
  it("returns 400 when metrics are missing or malformed", async () => {
    const result = await handleReportRequest({ venueName: "x" });
    expect(result.status).toBe(400);
  });

  it("returns a parsed report on success", async () => {
    vi.spyOn(upstage, "callUpstageJson").mockResolvedValue({
      summary: "요약",
      causes: [{ title: "병목", evidence: "남측 교차로 밀집" }],
      recommendations: [{ title: "일방통행", expectedEffect: "대피시간 단축" }],
      limitations: ["상대적 지표"],
    });
    const result = await handleReportRequest(validBody);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      summary: "요약",
      causes: [{ title: "병목", evidence: "남측 교차로 밀집" }],
    });
  });

  it("defensively drops malformed entries instead of throwing", async () => {
    vi.spyOn(upstage, "callUpstageJson").mockResolvedValue({
      summary: "요약",
      causes: [{ title: "ok" }, "not an object", { evidence: "missing title" }],
      recommendations: "not an array",
      limitations: [1, 2, "실제 문자열"],
    });
    const result = await handleReportRequest(validBody);
    expect(result.status).toBe(200);
    const body = result.body as { causes: unknown[]; recommendations: unknown[]; limitations: string[] };
    expect(body.causes).toHaveLength(1);
    expect(body.recommendations).toEqual([]);
    expect(body.limitations).toEqual(["실제 문자열"]);
  });

  it("surfaces an Upstage API error as a 502", async () => {
    vi.spyOn(upstage, "callUpstageJson").mockRejectedValue(new upstage.UpstageApiError(500, "boom"));
    const result = await handleReportRequest(validBody);
    expect(result.status).toBe(502);
  });
});
