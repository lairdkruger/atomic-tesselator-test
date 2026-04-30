# Visualisations — Overview

Six visualisation types for exploring atom probe tomography data. Listed in priority order.

## Priority 1 — Core

### 1. 3D Point Cloud
6.6M ions rendered as points in a ~42×42×71 nm volume. Color by element (m/q). WebGPU point rendering. Primary spatial view.

See: [point-cloud.md](point-cloud.md)

### 2. Mass Spectrum Histogram
m/q histogram — sharp peaks at integer Da identify elements/isotopes. Click a peak to highlight those ions in the 3D view.

See: [mass-spectrum.md](mass-spectrum.md)

### 3. Evaporation Sequence Scrubber
Range slider on ion index. Ions are ordered by evaporation depth (z increases with index). Controls which ions are visible across all views.

See: [evaporation-scrubber.md](evaporation-scrubber.md)

## Priority 2 — Analysis

### 4. Detector Heatmap
2D density plot of x_det vs y_det. Reveals detector artifacts, crystallographic poles, spatial uniformity. Diagnostic view.

See: [detector-heatmap.md](detector-heatmap.md)

### 5. Voltage Curve
Vdc vs ion index. Shows experiment progression. Anomalies indicate fractures or sudden evaporation events.

See: [voltage-curve.md](voltage-curve.md)

### 6. 1D Concentration Profile
Bin ions along z-axis, count elements per bin. Shows composition vs depth. Classic APT output.

See: [concentration-profile.md](concentration-profile.md)
