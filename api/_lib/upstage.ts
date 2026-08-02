/**
 * Minimal Upstage Solar chat client. Server-only: reads UPSTAGE_API_KEY
 * from process.env, never from client code (plan constraint: "Upstage API
 * 키는 브라우저에 노출하지 않고 백엔드 또는 서버리스 프록시에서 사용한다").
 *
 * Endpoint and model verified directly against the real API during
 * development (Aug 2026) with a live key - Upstage's own docs pages are
 * client-rendered and didn't yield a scrapable spec, so this was checked
 * empirically rather than copied from a page:
 *   POST https://api.upstage.ai/v1/solar/chat/completions
 *   { model: "solar-pro2", messages: [...], response_format: {type:"json_object"} }
 * returned 200 with valid JSON content in both a plain-text and a
 * response_format:"json_object" call.
 */

export interface UpstageMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const UPSTAGE_ENDPOINT = "https://api.upstage.ai/v1/solar/chat/completions";
const UPSTAGE_MODEL = process.env.UPSTAGE_MODEL ?? "solar-pro2";

export class UpstageConfigError extends Error {}
export class UpstageApiError extends Error {
  readonly status: number;
  constructor(status: number, detail: string) {
    super(`Upstage API error (${status}): ${detail}`);
    this.status = status;
  }
}

/** Calls Upstage's chat completions API with JSON-object response mode and
 * parses the model's message content as JSON. Throws UpstageConfigError if
 * no key is configured, UpstageApiError for a non-2xx response, or a plain
 * Error if the model's content isn't valid JSON despite the requested
 * response_format. */
export async function callUpstageJson(messages: UpstageMessage[]): Promise<unknown> {
  const apiKey = process.env.UPSTAGE_API_KEY;
  if (!apiKey) {
    throw new UpstageConfigError("UPSTAGE_API_KEY is not configured on the server");
  }

  const response = await fetch(UPSTAGE_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: UPSTAGE_MODEL,
      messages,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new UpstageApiError(response.status, detail || response.statusText);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("Upstage response was missing message content");
  }
  try {
    return JSON.parse(content);
  } catch {
    throw new Error("Upstage response content was not valid JSON");
  }
}
