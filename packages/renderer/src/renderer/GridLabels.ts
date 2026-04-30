import type { Camera } from "../camera";

interface LabelEntry {
  el: HTMLDivElement;
  wx: number;
  wy: number;
  wz: number;
}

export class GridLabels {
  private overlay: HTMLDivElement;
  private labels: LabelEntry[] = [];
  private canvasWidth = 0;
  private canvasHeight = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.overlay = document.createElement("div");
    this.overlay.style.cssText =
      "position:absolute;inset:0;pointer-events:none;overflow:hidden;";

    // insert overlay as sibling, positioned relative to canvas parent
    const parent = canvas.parentElement!;
    if (getComputedStyle(parent).position === "static") {
      parent.style.position = "relative";
    }
    parent.appendChild(this.overlay);

    this.canvasWidth = canvas.clientWidth;
    this.canvasHeight = canvas.clientHeight;
  }

  setGrid(
    minX: number, minY: number, minZ: number,
    maxX: number, maxY: number, maxZ: number,
    spacing: number,
  ): void {
    // clear existing labels
    this.overlay.innerHTML = "";
    this.labels = [];

    // labels along bottom edges of the bounding box
    // X ticks along (x, minY, minZ)
    for (let x = minX; x <= maxX + 0.001; x += spacing) {
      this.addLabel(`${Math.round(x)}`, x, minY, minZ);
    }

    // Y ticks along (minX, y, minZ)
    for (let y = minY; y <= maxY + 0.001; y += spacing) {
      this.addLabel(`${Math.round(y)}`, minX, y, minZ);
    }

    // Z ticks along (minX, minY, z)
    for (let z = minZ; z <= maxZ + 0.001; z += spacing) {
      this.addLabel(`${Math.round(z)}`, minX, minY, z);
    }

    // axis labels at endpoints
    this.addLabel("x (nm)", maxX, minY - spacing * 0.3, minZ);
    this.addLabel("y (nm)", minX - spacing * 0.3, maxY, minZ);
    this.addLabel("z (nm)", minX, minY - spacing * 0.3, maxZ);
  }

  private addLabel(text: string, wx: number, wy: number, wz: number): void {
    const el = document.createElement("div");
    el.textContent = text;
    el.style.cssText =
      "position:absolute;color:#666;font-size:10px;font-family:monospace;" +
      "white-space:nowrap;transform-origin:center center;will-change:transform;";
    this.overlay.appendChild(el);
    this.labels.push({ el, wx, wy, wz });
  }

  update(camera: Camera): void {
    const vp = camera.viewProjectionMatrix;
    const w = this.canvasWidth;
    const h = this.canvasHeight;

    for (const label of this.labels) {
      // project world → clip
      const x = label.wx;
      const y = label.wy;
      const z = label.wz;
      const d = vp.data;

      const clipX = d[0] * x + d[4] * y + d[8] * z + d[12];
      const clipY = d[1] * x + d[5] * y + d[9] * z + d[13];
      const clipW = d[3] * x + d[7] * y + d[11] * z + d[15];

      // behind camera or degenerate
      if (clipW <= 0.001) {
        label.el.style.display = "none";
        continue;
      }

      const ndcX = clipX / clipW;
      const ndcY = clipY / clipW;

      // NDC to screen (y flipped)
      const sx = (ndcX * 0.5 + 0.5) * w;
      const sy = (-ndcY * 0.5 + 0.5) * h;

      // off-screen check with margin
      if (sx < -50 || sx > w + 50 || sy < -50 || sy > h + 50) {
        label.el.style.display = "none";
        continue;
      }

      label.el.style.display = "";
      label.el.style.transform = `translate(${sx}px, ${sy}px)`;
    }
  }

  resize(width: number, height: number): void {
    this.canvasWidth = width;
    this.canvasHeight = height;
  }

  destroy(): void {
    this.overlay.remove();
    this.labels = [];
  }
}
