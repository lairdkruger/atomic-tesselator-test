import { FIELD_COUNT } from "./constants";

export class Ion {
  private view: Float32Array;
  private offset: number;

  constructor(view: Float32Array, index: number) {
    this.view = view;
    this.offset = index * FIELD_COUNT;
  }

  seek(index: number): this {
    this.offset = index * FIELD_COUNT;
    return this;
  }

  get x(): number {
    return this.view[this.offset]!;
  }
  get y(): number {
    return this.view[this.offset + 1]!;
  }
  get z(): number {
    return this.view[this.offset + 2]!;
  }
  get mq(): number {
    return this.view[this.offset + 3]!;
  }
  get tof(): number {
    return this.view[this.offset + 4]!;
  }
  get vdc(): number {
    return this.view[this.offset + 5]!;
  }
  get vpulse(): number {
    return this.view[this.offset + 6]!;
  }
  get xDet(): number {
    return this.view[this.offset + 7]!;
  }
  get yDet(): number {
    return this.view[this.offset + 8]!;
  }
  get deltaP(): number {
    return this.view[this.offset + 9]!;
  }
  get multi(): number {
    return this.view[this.offset + 10]!;
  }
}
