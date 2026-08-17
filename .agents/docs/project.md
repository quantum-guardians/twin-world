# Project Context

Fill this document during project initialization. Agents must verify commands against repository configuration before running them.

## Overview

- Product: Twin World — a digital-twin simulation service that analyses crowd
  density risk in festival and event spaces (다중밀집 사고). It edits a venue
  graph, optimizes one-way flow with MR2S, runs a 3D Social Force Model
  simulation, compares baseline against optimized, and generates an AI report.
- Repository: https://github.com/quantum-guardians/twin-world
- Primary users: event and festival safety planners; demo audiences.
- Core domain: venue graph editing, MR2S edge orientation, Dijkstra agent
  routing, Social Force Model crowd simulation, density and evacuation metrics.
- Runtime environment: browser. Vite 7 + React 19 + TypeScript 5.9, `three` /
  `@react-three/fiber` for 3D, `@xyflow/react` for the graph editor. Deployed to
  Vercel (`twin-world.vercel.app`) and GitHub Pages
  (`twinworld.maechuri.com`, via `CNAME`).

## Architecture

- Entry points: `index.html` → `src/main.tsx` → `src/App.tsx`. Server-side
  entry points are the Vercel functions `api/scenario.ts` and `api/report.ts`.
- Main modules: `src/domain/` holds venue and graph models (`venueGraph`,
  `busanPreset`, `corridors`, `buildings`, `grid`, `density`, `mr2sAdapter`,
  `rng`, `types`); `src/simulation/` holds the model and its React hooks
  (`engine`, `agents`, `socialForce`, `pressure`, `spatialGrid`, `metrics`,
  `alerts`, `visionHeuristic`, `useVenueSimulation`,
  `usePairedVenueSimulation`, `useAgentPovSelection`); `src/three/` holds the
  scene; `src/components/` holds graph, simulation, and comparison UI;
  `src/api/` holds the clients; `api/_lib/` holds the shared serverless handler
  code.
- Dependency direction: components depend on `src/domain`, `src/simulation`,
  `src/three`, and `src/api`; domain and simulation modules are pure
  TypeScript and import no React, which keeps them testable under a `node`
  environment.
- External systems: mr2s-backend at `https://quantum.yunseong.dev` through the
  `/mr2s-api` prefix (v1 optimization API, see `docs/BACKEND_REFERENCE.md`), and
  the Upstage Solar LLM, reached only from `api/` so the key never enters the
  bundle.
- Persistent data: none. All state is in-memory.

## Commands

| Purpose | Command |
|---|---|
| Install dependencies | `npm install` (CI uses `npm ci`) |
| Run locally | `npm run dev` |
| Format | TODO — none configured |
| Lint | `npm run lint` (oxlint) |
| Type-check | `npx tsc -b` |
| Unit tests | `npm test` (`vitest run`) |
| Integration tests | TODO — none |
| Build | `npm run build` (`tsc -b && vite build`) |

## Constraints

- Supported platforms: modern browsers with WebGL. Node 22 in CI.
- Compatibility requirements: the backend's CORS allowlist has no localhost
  entry, so browser requests use the `/mr2s-api` prefix — the Vite proxy in dev
  (`VITE_PROXY_TARGET` overrides the target), the `vercel.json` rewrite in
  production. The GitHub Pages deploy is static: it has neither that rewrite nor
  the `api/` functions, so MR2S optimization and the Upstage report work only on
  the Vercel deploy.
- Performance constraints: the per-frame agent loop is the hot path; neighbor
  lookups go through `src/simulation/spatialGrid.ts`. Paired baseline and
  optimized runs double the cost.
- Security or privacy requirements: `UPSTAGE_API_KEY` has no `VITE_` prefix on
  purpose — it is read with `process.env` inside `api/` only. Never move it into
  client code or prefix it.

## Ownership

- Maintainers: Yunseong <me@yunseong.dev>
- Sensitive modules: `api/_lib/upstage.ts`, `vite.config.ts`, `vercel.json`,
  `.github/workflows/pages.yml`, `src/simulation/socialForce.ts`,
  `src/simulation/pressure.ts`
- Changes requiring explicit review: force-model and alert thresholds, the MR2S
  request adapter, proxy and rewrite configuration, anything touching the
  Upstage key path.
