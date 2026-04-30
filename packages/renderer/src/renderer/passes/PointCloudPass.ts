import shader from "./PointCloudPass.wgsl?raw";

const PALETTE_SIZE = 128;
// header: point_size(f32) + ion_count(u32) + viewport_width(f32) + viewport_height(f32) = 16 bytes
// palette: 128 × vec4<f32> = 128 × 16 = 2048 bytes
const CONFIG_BUFFER_SIZE = 16 + PALETTE_SIZE * 16;

export interface ColorMapEntry {
  mqMin: number;
  mqMax: number;
  r: number;
  g: number;
  b: number;
  visibility?: number; // point size multiplier (default 1.0)
}

const DEFAULT_COLOR_MAP: ColorMapEntry[] = [
  { mqMin: 13.5, mqMax: 14.5, r: 0.4, g: 0.8, b: 0.4 }, // Si²⁺ (14)
  { mqMin: 15.5, mqMax: 16.5, r: 0.9, g: 0.3, b: 0.3 }, // O (16)
  { mqMin: 26.5, mqMax: 27.5, r: 0.3, g: 0.5, b: 0.9 }, // Al (27)
  { mqMin: 27.5, mqMax: 28.5, r: 0.3, g: 0.6, b: 1.0 }, // Si (28)
  { mqMin: 28.5, mqMax: 29.5, r: 0.4, g: 0.7, b: 0.9 }, // Si-29
  { mqMin: 31.5, mqMax: 32.5, r: 0.9, g: 0.5, b: 0.2 }, // O₂/S (32)
  { mqMin: 35.5, mqMax: 36.5, r: 0.7, g: 0.3, b: 0.7 }, // Ge²⁺ (36)
  { mqMin: 55.5, mqMax: 56.5, r: 0.8, g: 0.8, b: 0.3 }, // Fe (56)
  { mqMin: 69.5, mqMax: 70.5, r: 0.9, g: 0.2, b: 0.5 }, // Ge-70
  { mqMin: 71.5, mqMax: 72.5, r: 1.0, g: 0.2, b: 0.4 }, // Ge-72
  { mqMin: 72.5, mqMax: 73.5, r: 0.9, g: 0.3, b: 0.5 }, // Ge-73
  { mqMin: 73.5, mqMax: 74.5, r: 0.8, g: 0.3, b: 0.6 }, // Ge-74
];

export class PointCloudPass {
  private device: GPUDevice;
  private pipeline: GPURenderPipeline;
  private ionBuffer: GPUBuffer;
  private configBuffer: GPUBuffer;
  private ionBindGroup: GPUBindGroup;
  private configBindGroup: GPUBindGroup;
  private ionCount: number;
  private configData: Float32Array;
  private configU32: Uint32Array;

  constructor(
    device: GPUDevice,
    cameraBindGroupLayout: GPUBindGroupLayout,
    ionData: ArrayBuffer,
    ionCount: number,
    colorMap?: ColorMapEntry[],
  ) {
    this.device = device;
    this.ionCount = ionCount;

    // ion storage buffer
    this.ionBuffer = device.createBuffer({
      label: "Ion Storage Buffer",
      size: ionData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(this.ionBuffer, 0, ionData);

    // config uniform buffer (header + palette)
    this.configBuffer = device.createBuffer({
      label: "Point Cloud Config Buffer",
      size: CONFIG_BUFFER_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const buf = new ArrayBuffer(CONFIG_BUFFER_SIZE);
    this.configData = new Float32Array(buf);
    this.configU32 = new Uint32Array(buf);

    // header
    this.configData[0] = 0.005; // point_size
    this.configU32[1] = ionCount;
    this.configData[2] = 1; // viewport_width
    this.configData[3] = 1; // viewport_height

    // palette: 128 entries × 4 floats (rgba), starting at float offset 4
    this.writePalette(colorMap ?? DEFAULT_COLOR_MAP);
    device.queue.writeBuffer(this.configBuffer, 0, buf);

    // bind group layouts
    const ionBindGroupLayout = device.createBindGroupLayout({
      label: "Ion Bind Group Layout",
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: "read-only-storage" },
        },
      ],
    });

    const configBindGroupLayout = device.createBindGroupLayout({
      label: "Config Bind Group Layout",
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" },
        },
      ],
    });

    this.ionBindGroup = device.createBindGroup({
      label: "Ion Bind Group",
      layout: ionBindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: this.ionBuffer } }],
    });

    this.configBindGroup = device.createBindGroup({
      label: "Config Bind Group",
      layout: configBindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: this.configBuffer } }],
    });

    // pipeline
    const shaderModule = device.createShaderModule({
      label: "Point Cloud Shader",
      code: shader,
    });

    this.pipeline = device.createRenderPipeline({
      label: "Point Cloud Pipeline",
      layout: device.createPipelineLayout({
        bindGroupLayouts: [
          ionBindGroupLayout,
          cameraBindGroupLayout,
          configBindGroupLayout,
        ],
      }),
      vertex: {
        module: shaderModule,
        entryPoint: "vs_main",
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fs_main",
        targets: [{ format: "rgba16float" }],
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

  private writePalette(colorMap: ColorMapEntry[]): void {
    const paletteOffset = 4; // header is 4 floats

    // fill with default grey, visibility=1
    for (let i = 0; i < PALETTE_SIZE; i++) {
      const base = paletteOffset + i * 4;
      this.configData[base] = 0.3; // r
      this.configData[base + 1] = 0.3; // g
      this.configData[base + 2] = 0.3; // b
      this.configData[base + 3] = 1.0; // visibility
    }

    for (const entry of colorMap) {
      for (
        let mq = Math.floor(entry.mqMin);
        mq <= Math.ceil(entry.mqMax);
        mq++
      ) {
        if (mq >= 0 && mq < PALETTE_SIZE) {
          const base = paletteOffset + mq * 4;
          this.configData[base] = entry.r;
          this.configData[base + 1] = entry.g;
          this.configData[base + 2] = entry.b;
          this.configData[base + 3] = entry.visibility ?? 1.0;
        }
      }
    }
  }

  updatePalette(colorMap: ColorMapEntry[]): void {
    this.writePalette(colorMap);
    this.device.queue.writeBuffer(this.configBuffer, 0, this.configData.buffer);
  }

  resize(width: number, height: number): void {
    this.configData[2] = width;
    this.configData[3] = height;
    this.device.queue.writeBuffer(this.configBuffer, 0, this.configData.buffer);
  }

  render(
    encoder: GPUCommandEncoder,
    cameraBindGroup: GPUBindGroup,
    colorView: GPUTextureView,
    depthView: GPUTextureView,
  ): void {
    const passEncoder = encoder.beginRenderPass({
      label: "Point Cloud Pass",
      colorAttachments: [
        {
          view: colorView,
          clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
      depthStencilAttachment: {
        view: depthView,
        depthClearValue: 1.0,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
    });

    passEncoder.setPipeline(this.pipeline);
    passEncoder.setBindGroup(0, this.ionBindGroup);
    passEncoder.setBindGroup(1, cameraBindGroup);
    passEncoder.setBindGroup(2, this.configBindGroup);
    passEncoder.draw(3, this.ionCount);
    passEncoder.end();
  }

  destroy(): void {
    this.ionBuffer.destroy();
    this.configBuffer.destroy();
  }
}
