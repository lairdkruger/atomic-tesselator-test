# Evaporation Sequence Scrubber

Single-handle slider controlling how many ions (index 0..N) are visible across all views. Ions are ordered by evaporation sequence — scrubbing peels depth layers.

## UI

- Horizontal bar at bottom of dashboard, ~60-80px tall
- HTML range input with D3 sparkline (z-depth vs ion index) rendered behind the track
- Label showing current/total ion count (e.g. "3.2M / 6.6M")

## State

New nanostore `$ionCutoff: atom<number>` — current visible ion count. Default = `eposData.count` (all ions visible). All views subscribe.

## Point Cloud

Update draw instance count directly: `passEncoder.draw(3, cutoff)`. No shader or buffer changes. Expose `setIonCutoff(n)` on `Renderer` (delegates to `PointCloudPass`, matching existing `updatePointCloudPalette` pattern).

## Mass Spectrum

Precompute prefix-sum histogram at init:
- For each m/q bin, store a sorted array of ion indices that fall in that bin
- For cutoff N, binary search each bin's index array to get count of indices < N
- O(bins) per update, not O(ions)
- Update D3 bar heights in-place (no DOM rebuild)

## Sparkline

- Sample z-depth at ~500-1000 evenly spaced ion indices
- Render as D3 area chart behind slider track
- Static — computed once at data load

## Layout

Dashboard column order (top to bottom):
1. Point cloud (flex: 1)
2. Mass spectrum (200px)
3. Evaporation scrubber (~60-80px)
