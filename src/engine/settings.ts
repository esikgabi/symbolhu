import { RECENT, type CharStats, type StatsMap } from "./rules";

export interface Settings {
  pool: string[];
  gameSize: number;
  timeoutSec: number;
  hitsPerChar: number;
  maxRounds: number;
}

export const DEFAULTS = { gameSize: 5, timeoutSec: 3, hitsPerChar: 3, maxRounds: 10 };

const posInt = (v: unknown, d: number, max: number) => (Number.isInteger(v) && (v as number) >= 1 && (v as number) <= max ? (v as number) : d);

/** Never throws: anything invalid falls back to a default. */
export function sanitizeSettings(raw: unknown, known: (c: string) => boolean, defaultPool: string[]): Settings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const pool = Array.isArray(r.pool)
    ? [...new Set(r.pool.filter((c): c is string => typeof c === "string" && Array.from(c).length === 1 && known(c)))]
    : [];
  return {
    pool: pool.length ? pool : defaultPool,
    gameSize: posInt(r.gameSize, DEFAULTS.gameSize, 50),
    timeoutSec: typeof r.timeoutSec === "number" && r.timeoutSec > 0 && r.timeoutSec <= 60 ? r.timeoutSec : DEFAULTS.timeoutSec,
    hitsPerChar: posInt(r.hitsPerChar, DEFAULTS.hitsPerChar, 20),
    maxRounds: posInt(r.maxRounds, DEFAULTS.maxRounds, 100),
  };
}

export function sanitizeStats(raw: unknown): StatsMap {
  const out: StatsMap = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [c, v] of Object.entries(raw)) {
    const s = v as Partial<CharStats> | null;
    if (!s || !Array.isArray(s.recent)) continue;
    out[c] = {
      recent: s.recent.filter((h) => typeof h === "boolean").slice(-RECENT),
      asks: Number.isInteger(s.asks) ? s.asks! : 0,
      hits: Number.isInteger(s.hits) ? s.hits! : 0,
      masteredCount: Number.isInteger(s.masteredCount) ? s.masteredCount! : 0,
    };
  }
  return out;
}
