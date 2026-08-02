import { callUpstageJson, UpstageApiError, UpstageConfigError } from "./upstage.js";

export interface ScenarioRequestBody {
  description: string;
  defaultPopulation: number;
}

export interface ScenarioResult {
  population: number;
  summary: string;
  warnings: string[];
}

export interface HandlerResult {
  status: number;
  body: unknown;
}

const MIN_POPULATION = 1;
const MAX_POPULATION = 5000;

/**
 * AI role 1 (plan: "자연어 시나리오 구조화"). Turns a free-text Korean event
 * description into a validated population count for the simulation.
 * Safety: the model is asked for a small, fixed JSON shape and every field
 * is re-validated/clamped here before use - never trust the number
 * straight from the model into the simulation without a range check.
 */
export async function handleScenarioRequest(body: unknown): Promise<HandlerResult> {
  const request = body as Partial<ScenarioRequestBody> | null;
  if (!request || typeof request.description !== "string" || request.description.trim().length === 0) {
    return { status: 400, body: { error: "description is required" } };
  }
  const defaultPopulation =
    Number.isFinite(request.defaultPopulation) && (request.defaultPopulation as number) > 0
      ? Math.round(request.defaultPopulation as number)
      : 150;

  const messages = [
    {
      role: "system" as const,
      content:
        "You convert a Korean natural-language crowd-event description into a strict JSON object " +
        "with exactly these keys: population (integer), summary (one Korean sentence paraphrasing " +
        "the scenario for the user to confirm). Only output the JSON object, no other text. " +
        "If the description doesn't mention a number of people, estimate a plausible population for " +
        "a local festival/performance street (a few hundred) and say so in the summary.",
    },
    { role: "user" as const, content: request.description },
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
  const warnings: string[] = [];

  let population = Number(record.population);
  if (!Number.isFinite(population) || population <= 0) {
    warnings.push("AI가 인원수를 인식하지 못해 기본값을 사용했습니다.");
    population = defaultPopulation;
  }
  const clamped = Math.max(MIN_POPULATION, Math.min(MAX_POPULATION, Math.round(population)));
  if (clamped !== Math.round(population)) {
    warnings.push(`인원수를 ${MIN_POPULATION}~${MAX_POPULATION} 범위로 조정했습니다.`);
  }

  const summary = typeof record.summary === "string" && record.summary.length > 0 ? record.summary : request.description;

  const result: ScenarioResult = { population: clamped, summary, warnings };
  return { status: 200, body: result };
}
