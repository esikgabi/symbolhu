import { load } from "@tauri-apps/plugin-store";
import { defaultPool, layout } from "./layout";
import type { GameRecord, StatsMap } from "./engine/rules";
import { sanitizeSettings, sanitizeStats, type Settings } from "./engine/settings";

export interface Data {
  settings: Settings;
  stats: StatsMap;
  games: GameRecord[];
}

const FILE = "symbolhu.json";

async function backend() {
  if ("__TAURI_INTERNALS__" in window) {
    const s = await load(FILE, { autoSave: true, defaults: {} });
    return { get: (k: string) => s.get<unknown>(k), set: (k: string, v: unknown) => s.set(k, v), flush: () => s.save() };
  }
  // plain browser (bun run dev without Tauri): localStorage
  return {
    get: async (k: string) => JSON.parse(localStorage.getItem(`${FILE}:${k}`) ?? "null") as unknown,
    set: async (k: string, v: unknown) => localStorage.setItem(`${FILE}:${k}`, JSON.stringify(v)),
    flush: async () => {},
  };
}

const known = (c: string) => c in layout;

export async function loadData(): Promise<Data> {
  let b;
  try {
    b = await backend();
  } catch {
    return { settings: sanitizeSettings(null, known, defaultPool()), stats: {}, games: [] };
  }
  const safe = <T,>(p: Promise<T>) => p.catch(() => null as T | null);
  const games = await safe(b.get("games"));
  return {
    settings: sanitizeSettings(await safe(b.get("settings")), known, defaultPool()),
    stats: sanitizeStats(await safe(b.get("stats"))),
    games: Array.isArray(games)
      ? (games as GameRecord[]).filter((g) => g && Array.isArray(g.chars) && Array.isArray(g.rounds))
      : [],
  };
}

export async function saveData(d: Data): Promise<void> {
  const b = await backend();
  await b.set("settings", d.settings);
  await b.set("stats", d.stats);
  await b.set("games", d.games);
  await b.flush();
}
