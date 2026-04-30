import { atom, map, task } from "nanostores";
import type { EposData } from "parser";
import type { ColorMapEntry } from "renderer";
import { loadEposFromUrl, loadEposFromFile } from "../workers/epos-loader";

export const DEFAULT_COLOR_MAP: ColorMapEntry[] = [
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

export type AppStatus = "idle" | "loading" | "ready" | "error";

export const $appState = map<{
  status: AppStatus;
  message: string;
}>({
  status: "idle" as AppStatus,
  message: "",
});

export const $eposData = atom<EposData | null>(null);
export const $highlightedMq = atom<{ min: number; max: number } | null>(null);
export const $colorMap = atom<ColorMapEntry[]>(DEFAULT_COLOR_MAP);
export const $ionCutoff = atom<number>(0);

export function loadFile(file: File) {
  task(async () => {
    try {
      $appState.setKey("status", "loading");
      $appState.setKey("message", "Parsing EPOS file...");

      const data = await loadEposFromFile(file);

      $eposData.set(data);
      $ionCutoff.set(data.count);
      $appState.setKey("status", "ready");
      $appState.setKey("message", "");
    } catch (err) {
      $appState.setKey("status", "error");
      $appState.setKey("message", err instanceof Error ? err.message : "Failed to parse file");
    }
  });
}

export function loadData(url: string) {
  task(async () => {
    try {
      $appState.setKey("status", "loading");
      $appState.setKey("message", "Loading EPOS data...");

      const data = await loadEposFromUrl(url);

      $eposData.set(data);
      $ionCutoff.set(data.count);
      $appState.setKey("status", "ready");
      $appState.setKey("message", "");
    } catch (err) {
      $appState.setKey("status", "error");
      $appState.setKey("message", err instanceof Error ? err.message : "Failed to load data");
    }
  });
}
