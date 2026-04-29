/// <reference lib="webworker" />
import { parseEpos } from "parser";

declare const self: DedicatedWorkerGlobalScope & typeof globalThis;

export type WorkerResult =
  | { type: "success"; buffer: ArrayBuffer }
  | { type: "error"; message: string };

self.onmessage = (event: MessageEvent<ArrayBuffer>) => {
  try {
    const data = parseEpos(event.data);
    const buffer = data.buffer;
    self.postMessage({ type: "success", buffer } satisfies WorkerResult, [
      buffer,
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    self.postMessage({ type: "error", message } satisfies WorkerResult);
  }
};
