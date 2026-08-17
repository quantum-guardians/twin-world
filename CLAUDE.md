# CLAUDE.md

Twin World — a digital-twin service that edits a venue graph, optimizes one-way
flow with MR2S, runs a 3D Social Force Model crowd simulation, and compares
baseline against optimized to analyse crowd-density risk (다중밀집 사고).

## Instructions

This repository's agent instructions live in [`AGENTS.md`](AGENTS.md). Read it
first; it links the workflow, testing, and Git documents under `.agents/docs/`.

Read [`.agents/docs/project.md`](.agents/docs/project.md) before non-trivial
work. Verify any command against repository configuration before running it.
Two constraints are easy to break: keep `src/domain/` and the non-hook files in
`src/simulation/` free of React imports, and keep `UPSTAGE_API_KEY` server-side
in `api/` with no `VITE_` prefix.
