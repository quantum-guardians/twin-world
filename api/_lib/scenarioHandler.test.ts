import { afterEach, describe, expect, it, vi } from "vitest";
import * as upstage from "./upstage.js";
import { handleScenarioRequest } from "./scenarioHandler.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("handleScenarioRequest", () => {
  it("returns 400 when description is missing", async () => {
    const result = await handleScenarioRequest({});
    expect(result.status).toBe(400);
  });

  it("returns the AI's population and summary on success", async () => {
    vi.spyOn(upstage, "callUpstageJson").mockResolvedValue({ population: 3000, summary: "18시 3000명 유입" });
    const result = await handleScenarioRequest({ description: "18시부터 3000명", defaultPopulation: 150 });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ population: 3000, summary: "18시 3000명 유입", warnings: [] });
  });

  it("clamps a population above the allowed maximum and warns", async () => {
    vi.spyOn(upstage, "callUpstageJson").mockResolvedValue({ population: 999999, summary: "많음" });
    const result = await handleScenarioRequest({ description: "엄청 많이", defaultPopulation: 150 });
    expect(result.status).toBe(200);
    const body = result.body as { population: number; warnings: string[] };
    expect(body.population).toBe(5000);
    expect(body.warnings.length).toBeGreaterThan(0);
  });

  it("falls back to defaultPopulation and warns when the AI omits a usable number", async () => {
    vi.spyOn(upstage, "callUpstageJson").mockResolvedValue({ summary: "숫자 없음" });
    const result = await handleScenarioRequest({ description: "사람들이 많이 온다", defaultPopulation: 200 });
    const body = result.body as { population: number; warnings: string[] };
    expect(body.population).toBe(200);
    expect(body.warnings.length).toBeGreaterThan(0);
  });

  it("surfaces an Upstage config error as a 500", async () => {
    vi.spyOn(upstage, "callUpstageJson").mockRejectedValue(new upstage.UpstageConfigError("no key"));
    const result = await handleScenarioRequest({ description: "설명", defaultPopulation: 150 });
    expect(result.status).toBe(500);
  });

  it("surfaces an Upstage API error as a 502", async () => {
    vi.spyOn(upstage, "callUpstageJson").mockRejectedValue(new upstage.UpstageApiError(401, "bad key"));
    const result = await handleScenarioRequest({ description: "설명", defaultPopulation: 150 });
    expect(result.status).toBe(502);
  });
});
