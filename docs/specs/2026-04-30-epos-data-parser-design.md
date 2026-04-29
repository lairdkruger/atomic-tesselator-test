# EPOS Data Parser — Design Spec

## Overview

Parse binary EPOS atom probe tomography data into a GPU-ready ArrayBuffer with typed views. Parsing runs in a web worker to avoid blocking the main thread.

## Architecture

**Approach C** — parser package is a pure library; worker orchestration lives in frontend.

```
File/URL → ArrayBuffer → Worker → parseEpos() → endian-swapped buffer
  → transfer to main thread → EposData (views) + raw buffer (GPU-ready)
```

## EPOS File Format

- No header
- N × 11 × float32, big-endian
- Record size: 44 bytes (`PARTICLE_STRIDE`)
- Test file: 6,596,033 ions, 290,225,452 bytes

| # | Field | Key | Unit |
|---|-------|-----|------|
| 0 | x | x | nm |
| 1 | y | y | nm |
| 2 | z | z | nm |
| 3 | m/q | mq | Da |
| 4 | tof | tof | ns |
| 5 | Vdc | vdc | V |
| 6 | Vpulse | vpulse | V |
| 7 | x_det | xDet | mm |
| 8 | y_det | yDet | mm |
| 9 | delta_p | deltaP | — |
| 10 | multi | multi | — |

## Parser Package (`packages/parser`)

### Constants

```typescript
FIELD_COUNT = 11
FIELD_SIZE = 4        // float32
PARTICLE_STRIDE = 44  // 11 × 4
```

Field enum mapping index to name, exported for GPU shader struct alignment.

### `parseEpos(buffer: ArrayBuffer): EposData`

- Validates buffer size is divisible by 44 and non-empty
- Throws `EposParseError` with descriptive reason on failure
- Byte-swaps big-endian → little-endian float32 in-place (mutates input buffer)
- Uses DataView.getFloat32() read + Float32Array write for swap
- Returns `EposData` wrapping the swapped buffer

### `EposData`

Wraps the parsed ArrayBuffer with typed accessors.

- `count: number` — ion count
- `byteLength: number` — buffer size
- `buffer: ArrayBuffer` — raw GPU-ready buffer (little-endian, interleaved)
- `ion(index: number): Ion` — new zero-copy view per call, for ad-hoc inspection
- `cursor(): Ion` — reusable view with `.seek(index)`, for tight iteration loops
- `column(field: EposField): StridedColumnView` — strided accessor, cached per field

Constructor accepts `{ preSwapped: true }` flag — skips byte-swap but still validates structure (divisible by 44, non-empty).

### `Ion`

Lightweight view at offset `index * PARTICLE_STRIDE`.

Getter properties: `x`, `y`, `z`, `mq`, `tof`, `vdc`, `vpulse`, `xDet`, `yDet`, `deltaP`, `multi`.

Each reads from the underlying Float32Array at the correct offset. Zero-copy.

When used as cursor: `.seek(index)` updates the internal offset.

### `StridedColumnView`

Accessor for a single field across all ions. Reads from the interleaved buffer at stride 11 (floats).

- `get(index: number): number` — random access
- `length: number` — ion count
- `[Symbol.iterator]()` — iterable for `for...of`

Cached on `EposData` via `Map<EposField, StridedColumnView>` — `.column()` returns same instance on repeat calls.

### Error Handling

`EposParseError` extends `Error` with:
- Descriptive message (e.g. "buffer size 1234 not divisible by PARTICLE_STRIDE (44)")
- Always throw, never fail silently

### Exports

- `parseEpos` — main parse function
- `EposData` — class (for main-thread reconstruction)
- `Ion` — type
- `StridedColumnView` — type
- `EposParseError` — for `instanceof` checks
- `EposField` — field enum
- `FIELD_COUNT`, `FIELD_SIZE`, `PARTICLE_STRIDE` — constants
- Field offset map — for GPU shader struct alignment

## Frontend Worker Integration

### Worker Script (`frontend/src/workers/epos-parser.worker.ts`)

- Listens for message with ArrayBuffer payload
- Imports `parseEpos` from `@parser`
- Calls `parseEpos(buffer)`
- Posts back the swapped ArrayBuffer as transferable
- Catches all errors (not just `EposParseError`), posts structured error back

### Loader Module (`frontend/src/workers/epos-loader.ts`)

- `loadEposFromFile(file: File): Promise<ArrayBuffer>` — File.arrayBuffer() → worker → parsed buffer
- `loadEposFromUrl(url: string): Promise<ArrayBuffer>` — fetch → worker → parsed buffer
- Manages worker lifecycle: create → post → receive → `worker.terminate()`
- Rejects promise with descriptive error on any failure

### File Input

- **Dev**: auto-load from `public/data/local/atom_probe_tomography_data-public.epos`
- **Prod**: drag-and-drop file input, no extension validation

### Main Thread View Reconstruction

After receiving the transferred ArrayBuffer, wrap in `new EposData(buffer, { preSwapped: true })` to get `.ion()`, `.cursor()`, `.column()` accessors without re-swapping.

## GPU Handoff

- `EposData.buffer` is little-endian interleaved — pass directly to `device.createBuffer()` or `device.queue.writeBuffer()`
- `PARTICLE_STRIDE` and field offset constants exported for shader struct alignment
- No GPUBuffer creation in parser — that's the visualization layer
- No chunking — full buffer parsed at once (~277 MB, within reason for single allocation)

## Out of Scope

- Visualization / rendering
- Data filtering or analysis
- Chunked / streaming parse
- WebGL support
- File size limits
