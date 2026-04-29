import { FIELD_COUNT } from "./constants";
import type { EposFieldIndex } from "./constants";

export class StridedColumnView {
  private view: Float32Array;
  private fieldOffset: EposFieldIndex;
  readonly length: number;

  constructor(view: Float32Array, fieldIndex: EposFieldIndex, count: number) {
    this.view = view;
    this.fieldOffset = fieldIndex;
    this.length = count;
  }

  get(index: number): number {
    return this.view[index * FIELD_COUNT + this.fieldOffset]!;
  }

  *[Symbol.iterator](): Iterator<number> {
    for (let i = 0; i < this.length; i++) {
      yield this.view[i * FIELD_COUNT + this.fieldOffset]!;
    }
  }
}
