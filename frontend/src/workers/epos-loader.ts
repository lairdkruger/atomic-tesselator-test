import { EposData } from "parser";
import type { WorkerResult } from "./epos-parser.worker";

function spawnWorkerAndParse(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("./epos-parser.worker.ts", import.meta.url),
      { type: "module" }
    );

    worker.onmessage = (event: MessageEvent<WorkerResult>) => {
      worker.terminate();
      if (event.data.type === "success") {
        resolve(event.data.buffer);
      } else {
        reject(new Error(event.data.message));
      }
    };

    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message));
    };

    worker.postMessage(buffer, [buffer]);
  });
}

export async function loadEposFromFile(file: File): Promise<EposData> {
  const raw = await file.arrayBuffer();
  const buffer = await spawnWorkerAndParse(raw);
  return new EposData(buffer, { preSwapped: true });
}

export async function loadEposFromUrl(url: string): Promise<EposData> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`fetch failed: ${response.status} ${response.statusText}`);
  }
  const raw = await response.arrayBuffer();
  const buffer = await spawnWorkerAndParse(raw);
  return new EposData(buffer, { preSwapped: true });
}
