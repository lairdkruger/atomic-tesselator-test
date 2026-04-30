import type { EposData } from "parser";

export const BIN_WIDTH = 0.1;
export const MQ_MAX = 128;
export const BIN_COUNT = Math.ceil(MQ_MAX / BIN_WIDTH);

export type PrefixHistogram = Uint32Array[];

// for each m/q bin, sorted array of ion indices that fall in it
export function buildPrefixHistogram(eposData: EposData): PrefixHistogram {
  const mqCol = eposData.column("mq");
  const buckets: number[][] = Array.from({ length: BIN_COUNT }, () => []);

  for (let i = 0; i < eposData.count; i++) {
    const bin = Math.floor(mqCol.get(i) / BIN_WIDTH);
    if (bin >= 0 && bin < BIN_COUNT) {
      buckets[bin].push(i);
    }
  }

  // already sorted since we iterate indices in order
  return buckets.map((b) => new Uint32Array(b));
}

// write counts into pre-allocated output array — zero alloc per call
export function queryHistogramInto(
  hist: PrefixHistogram,
  cutoff: number,
  out: Uint32Array,
): void {
  for (let bin = 0; bin < hist.length; bin++) {
    const indices = hist[bin];
    if (indices.length === 0) {
      out[bin] = 0;
      continue;
    }

    // binary search for cutoff
    let lo = 0;
    let hi = indices.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (indices[mid] < cutoff) lo = mid + 1;
      else hi = mid;
    }

    out[bin] = lo;
  }
}
