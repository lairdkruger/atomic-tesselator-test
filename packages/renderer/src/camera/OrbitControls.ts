import { Vec3 } from "../math";
import { lerp, rateIndependentLerpingFactor } from "../math/interpolation";
import { Camera } from "./Camera";

const ORBIT_DECAY = 15;
const ZOOM_DECAY = 10;
const PAN_DECAY = 12;

export class OrbitControls {
  private canvas: HTMLCanvasElement;
  private camera: Camera;

  // desired state (set by input)
  private desiredTarget: Vec3 = Vec3.create();
  private desiredRadius: number;
  private desiredAzimuth: number;
  private desiredElevation: number;

  // current state (lerps toward desired)
  private currentTarget: Vec3 = Vec3.create();
  private currentRadius: number;
  private currentAzimuth: number;
  private currentElevation: number;

  private isDragging = false;
  private isPanning = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private lastTouchX = 0;
  private lastTouchY = 0;
  private lastPinchDistance = 0;

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

    this.desiredRadius = options?.radius ?? 50;
    this.desiredAzimuth = options?.azimuth ?? 0;
    this.desiredElevation = options?.elevation ?? 0.5;

    if (options?.target) {
      Vec3.copy(options.target, this.desiredTarget);
    }

    // init current to desired (no initial lerp)
    this.currentRadius = this.desiredRadius;
    this.currentAzimuth = this.desiredAzimuth;
    this.currentElevation = this.desiredElevation;
    Vec3.copy(this.desiredTarget, this.currentTarget);

    this.initMouse();
    this.initTouch();
    this.applyToCamera();
  }

  private initMouse(): void {
    this.canvas.addEventListener("mousedown", (e) => {
      if (e.button === 0) {
        this.isDragging = true;
      } else if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
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
        this.desiredAzimuth += dx * this.rotateSensitivity;
        this.desiredElevation += dy * this.rotateSensitivity;
        this.desiredElevation = Math.max(
          this.minElevation,
          Math.min(this.maxElevation, this.desiredElevation),
        );
      } else if (this.isPanning) {
        this.pan(dx, dy);
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
        this.desiredRadius = Math.max(
          this.minRadius,
          Math.min(this.maxRadius, this.desiredRadius * factor),
        );
      },
      { passive: false },
    );

    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  private initTouch(): void {
    this.canvas.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        if (e.touches.length === 1) {
          this.isDragging = true;
          this.isPanning = false;
          this.lastTouchX = e.touches[0].clientX;
          this.lastTouchY = e.touches[0].clientY;
        } else if (e.touches.length === 2) {
          this.isDragging = false;
          this.isPanning = true;
          this.lastPinchDistance = this.getTouchDistance(e.touches);
          const mid = this.getTouchMidpoint(e.touches);
          this.lastTouchX = mid.x;
          this.lastTouchY = mid.y;
        }
      },
      { passive: false },
    );

    this.canvas.addEventListener(
      "touchmove",
      (e) => {
        e.preventDefault();
        if (e.touches.length === 1 && this.isDragging) {
          const dx = e.touches[0].clientX - this.lastTouchX;
          const dy = e.touches[0].clientY - this.lastTouchY;
          this.lastTouchX = e.touches[0].clientX;
          this.lastTouchY = e.touches[0].clientY;
          this.desiredAzimuth += dx * this.rotateSensitivity;
          this.desiredElevation += dy * this.rotateSensitivity;
          this.desiredElevation = Math.max(
            this.minElevation,
            Math.min(this.maxElevation, this.desiredElevation),
          );
        } else if (e.touches.length === 2) {
          // pinch zoom
          const distance = this.getTouchDistance(e.touches);
          const pinchRatio = this.lastPinchDistance / distance;
          this.desiredRadius = Math.max(
            this.minRadius,
            Math.min(this.maxRadius, this.desiredRadius * pinchRatio),
          );
          this.lastPinchDistance = distance;
          // two-finger pan via midpoint delta
          const mid = this.getTouchMidpoint(e.touches);
          const dx = mid.x - this.lastTouchX;
          const dy = mid.y - this.lastTouchY;
          this.lastTouchX = mid.x;
          this.lastTouchY = mid.y;
          this.pan(dx, dy);
        }
      },
      { passive: false },
    );

    this.canvas.addEventListener("touchend", (e) => {
      if (e.touches.length === 1) {
        // transitioned 2→1 finger: switch back to orbit
        this.isDragging = true;
        this.isPanning = false;
        this.lastTouchX = e.touches[0].clientX;
        this.lastTouchY = e.touches[0].clientY;
      } else {
        this.isDragging = false;
        this.isPanning = false;
      }
    });
  }

  private getTouchDistance(touches: TouchList): number {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private getTouchMidpoint(touches: TouchList): { x: number; y: number } {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  }

  private pan(dx: number, dy: number): void {
    const cosAz = Math.cos(this.currentAzimuth);
    const sinAz = Math.sin(this.currentAzimuth);
    const panScale = this.panSensitivity * this.currentRadius * 0.01;

    const rightX = cosAz;
    const rightZ = sinAz;

    this.desiredTarget.x -= dx * panScale * rightX;
    this.desiredTarget.z -= dx * panScale * rightZ;
    this.desiredTarget.y += dy * panScale;
  }

  update(deltaTime: number): void {
    const orbitT = rateIndependentLerpingFactor(ORBIT_DECAY, deltaTime);
    const zoomT = rateIndependentLerpingFactor(ZOOM_DECAY, deltaTime);
    const panT = rateIndependentLerpingFactor(PAN_DECAY, deltaTime);

    this.currentAzimuth = lerp(this.currentAzimuth, this.desiredAzimuth, orbitT);
    this.currentElevation = lerp(this.currentElevation, this.desiredElevation, orbitT);
    this.currentRadius = lerp(this.currentRadius, this.desiredRadius, zoomT);
    this.currentTarget.x = lerp(this.currentTarget.x, this.desiredTarget.x, panT);
    this.currentTarget.y = lerp(this.currentTarget.y, this.desiredTarget.y, panT);
    this.currentTarget.z = lerp(this.currentTarget.z, this.desiredTarget.z, panT);

    this.applyToCamera();
  }

  private applyToCamera(): void {
    const cosEl = Math.cos(this.currentElevation);
    const sinEl = Math.sin(this.currentElevation);
    const cosAz = Math.cos(this.currentAzimuth);
    const sinAz = Math.sin(this.currentAzimuth);

    const x = this.currentTarget.x + this.currentRadius * cosEl * sinAz;
    const y = this.currentTarget.y + this.currentRadius * sinEl;
    const z = this.currentTarget.z + this.currentRadius * cosEl * cosAz;

    this.camera.transform.setPosition(x, y, z);
    this.camera.transform.lookAt(this.currentTarget);
    this.camera.needsUpdate = true;
  }

  setTarget(x: number, y: number, z: number): void {
    this.desiredTarget.set(x, y, z);
    // snap current to desired for initial positioning
    Vec3.copy(this.desiredTarget, this.currentTarget);
    this.applyToCamera();
  }

  setRadius(radius: number): void {
    this.desiredRadius = Math.max(this.minRadius, Math.min(this.maxRadius, radius));
    this.currentRadius = this.desiredRadius;
    this.applyToCamera();
  }
}
