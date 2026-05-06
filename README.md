# Atom Probe Data Visualisation

Interactive dashboard for exploring Atom Probe Tomography (APT) data. Renders millions of ions in real-time using WebGPU.

## Structure

Monorepo with three packages:

| Package | Description |
|---------|-------------|
| `frontend/` | Astro app. Dashboard with visualisation components, state management, and file loading. |
| `packages/parser` | Parses `.epos` binary format into typed columnar data. |
| `packages/renderer` | WebGPU renderer with point cloud, grid, and compositing passes. |

## Visualisations

- **3D Point Cloud** -- 6.6M ions rendered as billboarded points, colored by mass-to-charge ratio. Orbit controls.
- **Mass Spectrum** -- m/q histogram with zoom, click-to-highlight, and real-time filtering via D3.
- **Evaporation Scrubber** -- Slider controlling visible ion range. Updates point cloud and histogram in real-time.
- **Volumetric Grid** -- 3D lattice with projected HTML labels for spatial reference.

## Tech Stack

- Astro, TypeScript, nanostores
- WebGPU (point cloud and grid rendering)
- D3.js (histogram and sparkline)
- Web Workers (off-thread EPOS parsing)
