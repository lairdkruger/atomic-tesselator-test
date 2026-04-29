import { EposData } from "./epos-data";
import type { EposDataOptions } from "./epos-data";

export function parseEpos(buffer: ArrayBuffer, options?: EposDataOptions): EposData {
  return new EposData(buffer, options);
}
