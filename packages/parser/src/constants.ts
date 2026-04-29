export const FIELD_COUNT = 11;
export const FIELD_SIZE = 4; // float32
export const PARTICLE_STRIDE = FIELD_COUNT * FIELD_SIZE; // 44 bytes

export const EposField = {
  x: 0,
  y: 1,
  z: 2,
  mq: 3,
  tof: 4,
  vdc: 5,
  vpulse: 6,
  xDet: 7,
  yDet: 8,
  deltaP: 9,
  multi: 10,
} as const;

export type EposFieldName = keyof typeof EposField;
export type EposFieldIndex = (typeof EposField)[EposFieldName];

export const FIELD_NAMES: readonly EposFieldName[] = Object.keys(EposField) as EposFieldName[];
