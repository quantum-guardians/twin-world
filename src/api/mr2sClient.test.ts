import { afterEach, describe, expect, it, vi } from "vitest";
import { Mr2sApiError, Mr2sTimeoutError, optimizeMr2s } from "./mr2sClient";

function mockFetchOnce(response: Partial<Response> & { json?: () => Promise<unknown>; text?: () => Promise<string> }) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({}),
      text: async () => "",
      ...response,
    })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("optimizeMr2s", () => {
  it("returns the parsed JSON body on a 200 response", async () => {
    const body = { edges: [{ _from: 1, to: 2 }], optimized_graph_score: 5, bidirectional_graph_score: 8 };
    mockFetchOnce({ ok: true, status: 200, json: async () => body });
    await expect(optimizeMr2s({ edges: [] })).resolves.toEqual(body);
  });

  it("throws Mr2sTimeoutError on a 408 response", async () => {
    mockFetchOnce({ ok: false, status: 408 });
    await expect(optimizeMr2s({ edges: [] })).rejects.toBeInstanceOf(Mr2sTimeoutError);
  });

  it("throws Mr2sApiError with the status code on a 400/500 response", async () => {
    mockFetchOnce({ ok: false, status: 400, text: async () => "Invalid input: empty graph" });
    const err = await optimizeMr2s({ edges: [] }).catch((e) => e);
    expect(err).toBeInstanceOf(Mr2sApiError);
    expect(err.status).toBe(400);
    expect(err.message).toContain("Invalid input");
  });

  it("wraps a network-level failure (fetch rejecting) as Mr2sApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
    );
    await expect(optimizeMr2s({ edges: [] })).rejects.toBeInstanceOf(Mr2sApiError);
  });
});
