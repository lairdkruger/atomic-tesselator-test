import shader from "./GridPass.wgsl?raw";
import { GpuFloats, floatByteSize, alignVec4 } from "../../utils";

// config: color(vec4) + line_width(f32) + viewport(vec2) + pad = 8 floats
const CONFIG_FLOAT_COUNT = alignVec4(GpuFloats.vec4 + GpuFloats.f32 + GpuFloats.vec2 + GpuFloats.f32);
const CONFIG_BUFFER_SIZE = floatByteSize(CONFIG_FLOAT_COUNT);

// each line segment: 2 × vec4 (vec3 + padding) = 8 floats
const FLOATS_PER_LINE = 8;
const VERTS_PER_LINE = 6;

export interface GridOptions {
  color?: [number, number, number, number]; // rgba, default subtle grey
  lineWidth?: number; // pixels, default 1
}

export class GridPass {
  private device: GPUDevice;
  private pipeline: GPURenderPipeline;
  private configBuffer: GPUBuffer;
  private lineBuffer: GPUBuffer | null = null;
  private configBindGroup: GPUBindGroup;
  private lineBindGroup: GPUBindGroup | null = null;
  private lineBindGroupLayout: GPUBindGroupLayout;
  private configData: Float32Array;
  private lineCount = 0;

  constructor(
    device: GPUDevice,
    cameraBindGroupLayout: GPUBindGroupLayout,
    options?: GridOptions,
  ) {
    this.device = device;

    const color = options?.color ?? [0.4, 0.4, 0.4, 0.15];
    const lineWidth = options?.lineWidth ?? 1;

    // config buffer
    this.configBuffer = device.createBuffer({
      label: "Grid Config Buffer",
      size: CONFIG_BUFFER_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.configData = new Float32Array(CONFIG_FLOAT_COUNT);
    this.configData[0] = color[0];
    this.configData[1] = color[1];
    this.configData[2] = color[2];
    this.configData[3] = color[3];
    this.configData[4] = lineWidth;
    this.configData[5] = 1; // viewport width
    this.configData[6] = 1; // viewport height
    device.queue.writeBuffer(this.configBuffer, 0, this.configData.buffer);

    // bind group layouts
    const configBindGroupLayout = device.createBindGroupLayout({
      label: "Grid Config Bind Group Layout",
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" },
      }],
    });

    this.lineBindGroupLayout = device.createBindGroupLayout({
      label: "Grid Line Bind Group Layout",
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: "read-only-storage" },
      }],
    });

    this.configBindGroup = device.createBindGroup({
      label: "Grid Config Bind Group",
      layout: configBindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: this.configBuffer } }],
    });

    // pipeline
    const shaderModule = device.createShaderModule({
      label: "Grid Shader",
      code: shader,
    });

    this.pipeline = device.createRenderPipeline({
      label: "Grid Pipeline",
      layout: device.createPipelineLayout({
        bindGroupLayouts: [
          cameraBindGroupLayout,
          configBindGroupLayout,
          this.lineBindGroupLayout,
        ],
      }),
      vertex: {
        module: shaderModule,
        entryPoint: "vs_main",
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fs_main",
        targets: [{
          format: "rgba16float",
          blend: {
            color: {
              srcFactor: "src-alpha",
              dstFactor: "one-minus-src-alpha",
              operation: "add",
            },
            alpha: {
              srcFactor: "one",
              dstFactor: "one-minus-src-alpha",
              operation: "add",
            },
          },
        }],
      },
      primitive: {
        topology: "triangle-list",
      },
      depthStencil: {
        format: "depth32float",
        depthWriteEnabled: true,
        depthCompare: "less",
      },
    });
  }

  setGrid(
    minX: number, minY: number, minZ: number,
    maxX: number, maxY: number, maxZ: number,
    spacing: number,
  ): void {
    const segments: number[] = [];

    // generate line segments for each axis
    // X-axis lines: for each (y, z) tick, draw a line along X
    for (let y = minY; y <= maxY + 0.001; y += spacing) {
      for (let z = minZ; z <= maxZ + 0.001; z += spacing) {
        segments.push(minX, y, z, 0, maxX, y, z, 0);
      }
    }
    // Y-axis lines: for each (x, z) tick, draw a line along Y
    for (let x = minX; x <= maxX + 0.001; x += spacing) {
      for (let z = minZ; z <= maxZ + 0.001; z += spacing) {
        segments.push(x, minY, z, 0, x, maxY, z, 0);
      }
    }
    // Z-axis lines: for each (x, y) tick, draw a line along Z
    for (let x = minX; x <= maxX + 0.001; x += spacing) {
      for (let y = minY; y <= maxY + 0.001; y += spacing) {
        segments.push(x, y, minZ, 0, x, y, maxZ, 0);
      }
    }

    this.lineCount = segments.length / FLOATS_PER_LINE;
    const lineData = new Float32Array(segments);

    this.lineBuffer?.destroy();
    this.lineBuffer = this.device.createBuffer({
      label: "Grid Line Buffer",
      size: lineData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(this.lineBuffer, 0, lineData);

    this.lineBindGroup = this.device.createBindGroup({
      label: "Grid Line Bind Group",
      layout: this.lineBindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: this.lineBuffer } }],
    });
  }

  resize(width: number, height: number): void {
    this.configData[5] = width;
    this.configData[6] = height;
    this.device.queue.writeBuffer(this.configBuffer, 0, this.configData.buffer);
  }

  render(
    encoder: GPUCommandEncoder,
    cameraBindGroup: GPUBindGroup,
    colorView: GPUTextureView,
    depthView: GPUTextureView,
  ): void {
    if (!this.lineBindGroup || this.lineCount === 0) return;

    const passEncoder = encoder.beginRenderPass({
      label: "Grid Pass",
      colorAttachments: [{
        view: colorView,
        clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1 },
        loadOp: "clear",
        storeOp: "store",
      }],
      depthStencilAttachment: {
        view: depthView,
        depthClearValue: 1.0,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
    });

    passEncoder.setPipeline(this.pipeline);
    passEncoder.setBindGroup(0, cameraBindGroup);
    passEncoder.setBindGroup(1, this.configBindGroup);
    passEncoder.setBindGroup(2, this.lineBindGroup);
    passEncoder.draw(VERTS_PER_LINE, this.lineCount);
    passEncoder.end();
  }

  destroy(): void {
    this.configBuffer.destroy();
    this.lineBuffer?.destroy();
  }
}
