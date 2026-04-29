# AGENTS.md

## Project

Technical test: explore and visualise atom probe tomography (APT) data.
Output: interactive dashboard for data exploration.

## Stack

| Layer | Tech |
|---|---|
| Monorepo | pnpm workspaces |
| Frontend | Astro (`frontend/`) |
| Packages | Standalone utilities (`packages/`) |
| Types | Strict TypeScript throughout |

## Data

**File:** `data/atom_probe_tomography_data-public.epos`  
**Format:** Binary EPOS — no header, N × 11 × `float32` big-endian  
**Record count:** 6,596,033 ions  
**Record size:** 44 bytes (11 × 4)  
**File size:** 290,225,452 bytes  
**Fields per record (in order):**

| # | Field | Unit |
|---|---|---|
| 0 | x | nm |
| 1 | y | nm |
| 2 | z | nm |
| 3 | m/q | Da |
| 4 | tof | ns |
| 5 | Vdc | V |
| 6 | Vpulse | V |
| 7 | x_det | mm |
| 8 | y_det | mm |
| 9 | delta_p | — |
| 10 | multi | — |

## Packages

### `packages/parser`

Parses `.epos` binary into typed structures. Built first.  
Exports a typed, tree-shakeable ESM API. No runtime dependencies.

## Conventions

- Fully typed — no `any`, no implicit `unknown`
- Minimal deps — prefer native APIs
- Clean structure — one concern per file
- No unnecessary comments — code should be self-documenting
- Commits: imperative, lowercase, ≤60 chars
- Assertions over silence — always throw descriptive errors, never fail silently
- File names: kebab-case (e.g. `epos-data.ts`, `strided-column-view.ts`)
- Imports: omit file extensions (e.g. `from "./constants"` not `from "./constants.js"`)
