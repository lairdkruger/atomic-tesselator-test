import { Vec3 } from "../math";
import { Camera } from "./Camera";

export class OrbitControls {
  private canvas: HTMLCanvasElement;
  private camera: Camera;

  private target: Vec3 = Vec3.create();
  private radius: number;
  private azimuth: number;
  private elevation: number;

  private isDragging = false;
  private isPanning = false;
  private lastMouseX = 0;
  private lastMouseY = 0;

  private readonly rotateSensitivity = 0.005;
  private readonly panSensitivity = 0.01;
  private readonly zoomSpeed = 0.1;
  private readonly minRadius = 0.1;
  private readonly maxRadius = 500;
  private readonly minElevation = -Math.PI / 2 + 0.01;
  private readonly maxElevation = Math.PI / 2 - 0.01;

  constructor(
    canvas: HTMLCanvasElement,
    camera: Camera,
    options?: {
      target?: Vec3;
      radius?: number;
      azimuth?: number;
      elevation?: number;
    },
  ) {
    this.canvas = canvas;
    this.camera = camera;
    this.radius = options?.radius ?? 50;
    this.azimuth = options?.azimuth ?? 0;
    this.elevation = options?.elevation ?? 0.5;

    if (options?.target) {
      Vec3.copy(options.target, this.target);
    }

    this.initMouse();
    this.applyToCamera();
  }

  private initMouse(): void {
    this.canvas.addEventListener("mousedown", (e) => {
      if (e.button === 0) {
        // left click: rotate
        this.isDragging = true;
      } else if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
        // middle click or shift+left: pan
        this.isPanning = true;
      }
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    });

    document.addEventListener("mousemove", (e) => {
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;

      if (this.isDragging) {
        this.azimuth += dx * this.rotateSensitivity;
        this.elevation += dy * this.rotateSensitivity;
        this.elevation = Math.max(
          this.minElevation,
          Math.min(this.maxElevation, this.elevation),
        );
        this.applyToCamera();
      } else if (this.isPanning) {
        this.pan(dx, dy);
        this.applyToCamera();
      }
    });

    document.addEventListener("mouseup", () => {
      this.isDragging = false;
      this.isPanning = false;
    });

    this.canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const factor = 1 + Math.sign(e.deltaY) * this.zoomSpeed;
        this.radius = Math.max(
          this.minRadius,
          Math.min(this.maxRadius, this.radius * factor),
        );
        this.applyToCamera();
      },
      { passive: false },
    );

    // prevent context menu on right click
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  private pan(dx: number, dy: number): void {
    // pan in camera-local right and up directions
    const cosAz = Math.cos(this.azimuth);
    const sinAz = Math.sin(this.azimuth);

    const panScale = this.panSensitivity * this.radius * 0.01;

    // right vector (in xz plane, perpendicular to view)
    const rightX = cosAz;
    const rightZ = sinAz;

    // up vector (world up for simplicity)
    this.target.x -= dx * panScale * rightX;
    this.target.z -= dx * panScale * rightZ;
    this.target.y += dy * panScale;
  }

  update(): void {
    const cosEl = Math.cos(this.elevation);
    const sinEl = Math.sin(this.elevation);
    const cosAz = Math.cos(this.azimuth);
    const sinAz = Math.sin(this.azimuth);

    const x = this.target.x + this.radius * cosEl * sinAz;
    const y = this.target.y + this.radius * sinEl;
    const z = this.target.z + this.radius * cosEl * cosAz;

    this.camera.transform.setPosition(x, y, z);
    this.camera.transform.lookAt(this.target);
    this.camera.needsUpdate = true;
  }

  private applyToCamera(): void {
    this.update();
  }

  setTarget(x: number, y: number, z: number): void {
    this.target.set(x, y, z);
    this.applyToCamera();
  }

  setRadius(radius: number): void {
    this.radius = Math.max(this.minRadius, Math.min(this.maxRadius, radius));
    this.applyToCamera();
  }
}
