import { PARTICLE_STRIDE, FIELD_COUNT, EposField } from "./constants";
import type { EposFieldName, EposFieldIndex } from "./constants";
import { EposParseError } from "./error";
import { Ion } from "./ion";
import { StridedColumnView } from "./strided-column-view";

export interface EposDataOptions {
  preSwapped?: boolean;
}

export class EposData {
  readonly buffer: ArrayBuffer;
  readonly count: number;
  readonly byteLength: number;

  private readonly floatView: Float32Array;
  private readonly columnCache = new Map<EposFieldIndex, StridedColumnView>();

  constructor(buffer: ArrayBuffer, options?: EposDataOptions) {
    if (buffer.byteLength === 0) {
      throw new EposParseError("buffer is empty");
    }
    if (buffer.byteLength % PARTICLE_STRIDE !== 0) {
      throw new EposParseError(
        `buffer size ${buffer.byteLength} not divisible by PARTICLE_STRIDE (${PARTICLE_STRIDE})`
      );
    }

    this.buffer = buffer;
    this.byteLength = buffer.byteLength;
    this.count = buffer.byteLength / PARTICLE_STRIDE;
    this.floatView = new Float32Array(buffer);

    if (!options?.preSwapped) {
      this.swapEndianness();
    }
  }

  ion(index: number): Ion {
    return new Ion(this.floatView, index);
  }

  cursor(): Ion {
    return new Ion(this.floatView, 0);
  }

  column(field: EposFieldName): StridedColumnView {
    const fieldIndex = EposField[field];
    const cached = this.columnCache.get(fieldIndex);
    if (cached) return cached;

    const view = new StridedColumnView(this.floatView, fieldIndex, this.count);
    this.columnCache.set(fieldIndex, view);
    return view;
  }

  private swapEndianness(): void {
    const dataView = new DataView(this.buffer);
    const totalFloats = this.count * FIELD_COUNT;

    for (let i = 0; i < totalFloats; i++) {
      const byteOffset = i * 4;
      // read big-endian, write as native little-endian via Float32Array
      this.floatView[i] = dataView.getFloat32(byteOffset, false);
    }
  }
}
