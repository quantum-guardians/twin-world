import type { IncomingMessage } from "node:http";

/** Reads and parses a JSON request body from a raw Node request. Shared by
 * the Vercel function entrypoints and the Vite dev-server middleware (see
 * vite.config.ts) so both run the exact same request-handling code path. */
export async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf-8");
  return raw.length > 0 ? JSON.parse(raw) : {};
}
