# Project Agent Instructions

## Scope and Precedence

This file is the repository-level entrypoint for coding agents.

Read `.agents/docs/project.md` before non-trivial
work. Repository-specific commands, constraints, and narrower instructions take
precedence over these template defaults.

## Project Workflow

For non-trivial work, follow:

- `.agents/docs/workflow.md`
- `.agents/docs/testing.md`

For tracked Git work, follow:

- `.agents/docs/issue.md`
- `.agents/docs/branch.md`
- `.agents/docs/commit.md`
- `.agents/docs/pull-request.md`

For published releases, follow:

- `.agents/docs/release.md`

Use project-local skills when installed and applicable. Skill instructions
define their own triggers, formats, and output paths.

## Project Structure & Module Organization

`index.html` boots `src/main.tsx`, which mounts `src/App.tsx`. Pure model code
lives in two places: `src/domain/` for the venue and graph model
(`venueGraph.ts`, `busanPreset.ts`, `corridors.ts`, `buildings.ts`, `grid.ts`,
`density.ts`, `mr2sAdapter.ts`, `rng.ts`, `types.ts`) and `src/simulation/` for
crowd behavior (`engine.ts`, `agents.ts`, `socialForce.ts`, `pressure.ts`,
`spatialGrid.ts`, `metrics.ts`, `alerts.ts`, `visionHeuristic.ts`) plus its
React hooks (`useVenueSimulation`, `usePairedVenueSimulation`,
`useAgentPovSelection`). The 3D scene is in `src/three/`, UI in
`src/components/{graph,simulation,comparison}/`, backend clients in `src/api/`,
and the serverless functions in `api/` with their shared logic in `api/_lib/`.
Reference material lives in `docs/` (`BACKEND_REFERENCE.md`, `API.md`,
`agent-movement.md`, `crowd-model.html`).

Keep `src/domain/` and the non-hook files in `src/simulation/` free of React
imports. That boundary is why the model runs under vitest's `node` environment;
a hook inside a force computation breaks it.

## External Integrations

MR2S orientation comes from the deployed mr2s-backend over the v1 API, reached
through the `/mr2s-api` prefix: the Vite proxy in dev (override the target with
`VITE_PROXY_TARGET` when running a local backend) and the `vercel.json` rewrite
in production. The backend's CORS allowlist has no localhost entry, so never
call `https://quantum.yunseong.dev` directly from client code.

The Upstage Solar LLM is reached only from `api/scenario.ts` and
`api/report.ts`, which share `api/_lib/`. `UPSTAGE_API_KEY` deliberately has no
`VITE_` prefix so it stays out of the bundle; it is read with `process.env` on
the server. `vite.config.ts` runs the same `api/_lib` handlers as dev middleware
so `npm run dev` exercises the real integration — add new server logic to
`api/_lib/` and wire both entry points, rather than duplicating it.

Note that the GitHub Pages deploy is a static bundle with no rewrite and no
serverless functions: MR2S optimization and report generation work only on the
Vercel deploy.

## Build, Test, and Development Commands

Install with `npm install`. `npm run dev` starts Vite with the API middleware,
`npm test` runs `vitest run`, `npm run lint` runs oxlint, `npm run build` runs
`tsc -b && vite build`, and `npm run preview` serves the build. Pushes to `main`
trigger `.github/workflows/pages.yml`, which runs `npm ci && npm run build`,
copies `CNAME` into `dist/`, and publishes to GitHub Pages — so a build failure
on `main` takes the custom domain down, and `CNAME` must keep being copied or
the domain is dropped.

## Coding Style & Naming Conventions

TypeScript strict mode, 2-space indentation, single quotes, no semicolons where
the surrounding file omits them. Domain and simulation modules are
`camelCase.ts` exporting pure functions; components and scene objects are
`PascalCase.tsx`; hooks are `useThing.ts`. oxlint enforces
`react/rules-of-hooks` as an error and `react/only-export-components` as a
warning — fix rather than disable. Randomness goes through `src/domain/rng.ts`
so runs stay reproducible; do not call `Math.random()` in model code.

## Testing Guidelines

Tests are colocated as `<module>.test.ts` and run under vitest's `node`
environment. `engine`, `agents`, `alerts`, `metrics`, `visionHeuristic`,
`venueGraph`, `corridors`, `buildings`, `grid`, `density`, `busanPreset`,
`mr2sAdapter`, `flyControls`, `mr2sClient`, `scenarioHandler`, and
`reportHandler` already have suites; extend the matching file instead of adding
a parallel one. Use fixed seeds and explicit agent positions — never assert on
unseeded randomness. The 3D scene and camera controls are only partly covered,
so state in the pull request what you verified by running the simulation.

## Commit & Pull Request Guidelines

History uses short imperative Conventional Commit subjects with a scope, such as
`feat(sim): warn when the crowd turns dangerous` and
`fix(camera): move free-fly boost off Ctrl`. Pull requests should describe the
behavioral change, link the issue, give the old and new value for any tuned
model constant or threshold, and report the density, alert, or evacuation
metrics when crowd behavior changes.
