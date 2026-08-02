/// <reference types="vitest/config" />
import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { readJsonBody } from './api/_lib/readJsonBody.js'
import { handleScenarioRequest } from './api/_lib/scenarioHandler.js'
import { handleReportRequest } from './api/_lib/reportHandler.js'

async function respondJson(
  req: IncomingMessage,
  res: ServerResponse,
  handle: (body: unknown) => Promise<{ status: number; body: unknown }>
): Promise<void> {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }
  let body: unknown
  try {
    body = await readJsonBody(req)
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Invalid JSON body' }))
    return
  }
  const result = await handle(body)
  res.writeHead(result.status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(result.body))
}

/** Dev-only equivalent of the /api/*.ts Vercel functions, running the same
 * handler code (api/_lib) inside the Vite dev server so `npm run dev`
 * exercises the real Upstage integration without needing the Vercel CLI.
 * Production deploys use the /api files directly - Vercel builds each one
 * as its own serverless function. */
function upstageApiDevMiddleware(): Plugin {
  return {
    name: 'twin-world-upstage-api-dev-middleware',
    configureServer(server) {
      server.middlewares.use('/api/scenario', (req, res) => {
        void respondJson(req, res, handleScenarioRequest)
      })
      server.middlewares.use('/api/report', (req, res) => {
        void respondJson(req, res, handleReportRequest)
      })
    },
  }
}

// mr2s-backend's CORS allowlist only covers its deployed frontend origins
// (no localhost), so local dev goes through this proxy instead of calling
// the backend directly. Same "/mr2s-api" prefix convention as
// simulation_react, stripped before forwarding.
export default defineConfig(({ mode }) => {
  // Vite doesn't populate process.env from .env files on its own (only
  // import.meta.env for client code) - load .env.local explicitly so the
  // dev-only API middleware above can read UPSTAGE_API_KEY server-side.
  const env = loadEnv(mode, process.cwd(), '')
  process.env.UPSTAGE_API_KEY ??= env.UPSTAGE_API_KEY
  process.env.UPSTAGE_MODEL ??= env.UPSTAGE_MODEL

  return {
    plugins: [react(), upstageApiDevMiddleware()],
    server: {
      proxy: {
        '/mr2s-api': {
          target: process.env.VITE_PROXY_TARGET ?? 'https://quantum.yunseong.dev',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/mr2s-api/, ''),
        },
      },
    },
    test: {
      environment: 'node',
    },
  }
})
