import { Camera } from "../camera";
import { OutputPass } from "./passes/OutputPass";
import { PointCloudPass } from "./passes/PointCloudPass";
import type { ColorMapEntry } from "./passes/PointCloudPass";
import { createCameraBindGroupLayout } from "../camera/CameraUniforms";

export interface RendererOptions {
  devicePixelRatio?: number;
  alphaMode?: GPUCanvasAlphaMode;
  outputFilter?: "nearest" | "linear";
}

export class Renderer {
  private canvas: HTMLCanvasElement;
  private device: GPUDevice;
  private context: GPUCanvasContext;
  private format: GPUTextureFormat;
  private alphaMode: GPUCanvasAlphaMode;
  private devicePixelRatio: number;
  private cameras: Set<Camera> = new Set();

  public renderWidth: number = 0;
  public renderHeight: number = 0;

  private outputPass: OutputPass;
  private pointCloudPass: PointCloudPass | null = null;
  private cameraBindGroupLayout: GPUBindGroupLayout;

  private renderTexture: GPUTexture | null = null;
  private renderTextureView: GPUTextureView | null = null;
  private depthTexture: GPUTexture | null = null;
  private depthTextureView: GPUTextureView | null = null;

  private constructor(
    canvas: HTMLCanvasElement,
    device: GPUDevice,
    context: GPUCanvasContext,
    format: GPUTextureFormat,
    options: RendererOptions,
  ) {
    this.canvas = canvas;
    this.device = device;
    this.context = context;
    this.format = format;
    this.alphaMode = options.alphaMode ?? "premultiplied";
    this.devicePixelRatio = options.devicePixelRatio ?? 1;

    const dpr = this.devicePixelRatio;
    const rect = this.canvas.getBoundingClientRect();
    this.renderWidth = Math.round(rect.width * dpr);
    this.renderHeight = Math.round(rect.height * dpr);

    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: this.alphaMode,
    });

    this.cameraBindGroupLayout = createCameraBindGroupLayout(this.device);

    this.outputPass = new OutputPass(
      this.device,
      this.format,
      options.outputFilter ?? "nearest",
    );

    this.resize(rect.width, rect.height);
  }

  static async create(
    canvas: HTMLCanvasElement,
    options: RendererOptions = {},
  ): Promise<Renderer> {
    if (!navigator.gpu) {
      throw new Error("WebGPU not supported");
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error("no WebGPU adapter found");
    }

    const device = await adapter.requestDevice({
      requiredLimits: {
        maxBufferSize: adapter.limits.maxBufferSize,
        maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
      },
    });
    const context = canvas.getContext("webgpu");
    if (!context) {
      throw new Error("could not get WebGPU context");
    }

    const format = navigator.gpu.getPreferredCanvasFormat();

    return new Renderer(canvas, device, context, format, options);
  }

  resize(width: number, height: number): void {
    if (!this.device || !this.context) return;

    const dpr = this.devicePixelRatio;
    const w = Math.round(width * dpr);
    const h = Math.round(height * dpr);

    if (this.canvas.width === w && this.canvas.height === h) return;

    this.canvas.width = Math.max(
      1,
      Math.min(w, this.device.limits.maxTextureDimension2D),
    );
    this.canvas.height = Math.max(
      1,
      Math.min(h, this.device.limits.maxTextureDimension2D),
    );

    this.renderWidth = this.canvas.width;
    this.renderHeight = this.canvas.height;

    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: this.alphaMode,
    });

    for (const camera of this.cameras) {
      camera.resize(this.canvas.width, this.canvas.height);
      camera.update();
    }

    this.recreateRenderTargets();
  }

  public registerCamera(camera: Camera): void {
    this.cameras.add(camera);
    if (this.device) {
      camera.resize(this.canvas.width, this.canvas.height);
      camera.update();
    }
  }

  public unregisterCamera(camera: Camera): void {
    this.cameras.delete(camera);
  }

  public setPointCloudBuffer(buffer: ArrayBuffer, ionCount: number): void {
    if (this.pointCloudPass) {
      this.pointCloudPass.destroy();
    }

    this.pointCloudPass = new PointCloudPass(
      this.device,
      this.cameraBindGroupLayout,
      buffer,
      ionCount,
    );
    this.pointCloudPass.resize(this.renderWidth, this.renderHeight);
  }

  public updatePointCloudPalette(colorMap: ColorMapEntry[]): void {
    this.pointCloudPass?.updatePalette(colorMap);
  }

  render(camera: Camera): void {
    if (!this.renderTextureView || !this.depthTextureView) return;

    camera.update();

    const commandEncoder = this.device.createCommandEncoder();

    if (this.pointCloudPass) {
      this.pointCloudPass.render(
        commandEncoder,
        camera.uniforms.bindGroup,
        this.renderTextureView,
        this.depthTextureView,
      );
    }

    const swapChainView = this.context.getCurrentTexture().createView();
    this.outputPass.render(commandEncoder, this.renderTextureView, swapChainView);

    this.device.queue.submit([commandEncoder.finish()]);
  }

  public getDevice(): GPUDevice {
    return this.device;
  }

  public getCameraBindGroupLayout(): GPUBindGroupLayout {
    return this.cameraBindGroupLayout;
  }

  public getRenderResolution(): { width: number; height: number } {
    return { width: this.renderWidth, height: this.renderHeight };
  }

  public getViewportSize(): { width: number; height: number } {
    return { width: this.canvas.width, height: this.canvas.height };
  }

  private recreateRenderTargets(): void {
    this.renderTexture?.destroy();
    this.depthTexture?.destroy();

    this.renderTexture = this.device.createTexture({
      label: "Render Target",
      size: [this.renderWidth, this.renderHeight],
      format: "rgba16float",
      usage:
        GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.renderTextureView = this.renderTexture.createView();

    this.depthTexture = this.device.createTexture({
      label: "Depth Target",
      size: [this.renderWidth, this.renderHeight],
      format: "depth32float",
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.depthTextureView = this.depthTexture.createView();

    this.pointCloudPass?.resize(this.renderWidth, this.renderHeight);
  }

  public destroy(): void {
    this.renderTexture?.destroy();
    this.depthTexture?.destroy();
    this.pointCloudPass?.destroy();
  }
}
