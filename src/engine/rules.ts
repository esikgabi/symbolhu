export interface Ask {
  char: string;
  hit: boolean;
}
export interface CharStats {
  recent: boolean[]; // last RECENT asks, true = hit
  asks: number;
  hits: number;
  masteredCount: number;
}
export type StatsMap = Record<string, CharStats>;
export interface RoundRecord {
  asked: string[];
  mastered: string[];
}
export interface GameRecord {
  date: string;
  chars: string[];
  rounds: RoundRecord[];
}
export type Rng = () => number;

export const RECENT = 30;
export const DEFAULT_CHARS = ["<", ">", "*", "(", ")"];

/** Each char `times` times, shuffled, never the same char twice in a row (when possible). */
export function buildQueue(chars: string[], times: number, rng: Rng = Math.random): string[] {
  const left: Record<string, number> = {};
  for (const c of chars) left[c] = times;
  const out: string[] = [];
  for (let n = chars.length * times; n > 0; n--) {
    const last = out[out.length - 1];
    const cand = chars.filter((c) => left[c] > 0 && c !== last);
    // a char holding more than half of what is left must go now, or a repeat becomes unavoidable
    const forced = cand.filter((c) => left[c] * 2 > n);
    const pool = forced.length ? forced : cand.length ? cand : chars.filter((c) => left[c] > 0);
    const pick = pool[Math.floor(rng() * pool.length)];
    left[pick]--;
    out.push(pick);
  }
  return out;
}

export function scoreRound(asks: Ask[], active: string[], hitsPerChar: number): RoundRecord {
  const mastered = active.filter(
    (c) => asks.filter((a) => a.char === c && a.hit).length >= hitsPerChar,
  );
  return { asked: [...active], mastered };
}

export function recordResults(stats: StatsMap, asks: Ask[], mastered: string[]): StatsMap {
  const next: StatsMap = { ...stats };
  for (const { char, hit } of asks) {
    const s = next[char] ?? { recent: [], asks: 0, hits: 0, masteredCount: 0 };
    next[char] = {
      ...s,
      recent: [...s.recent, hit].slice(-RECENT),
      asks: s.asks + 1,
      hits: s.hits + (hit ? 1 : 0),
    };
  }
  for (const c of mastered) {
    const s = next[c];
    if (s) next[c] = { ...s, masteredCount: s.masteredCount + 1 };
  }
  return next;
}

/** Miss rate over the recent asks; unseen characters score 0.5. */
export function weakness(s?: CharStats): number {
  if (!s || s.recent.length === 0) return 0.5;
  return s.recent.filter((h) => !h).length / s.recent.length;
}

export function pickGameChars(pool: string[], stats: StatsMap, size: number, rng: Rng = Math.random): string[] {
  const noHistory = !pool.some((c) => stats[c]?.recent.length);
  const ordered = noHistory
    ? [...DEFAULT_CHARS.filter((c) => pool.includes(c)), ...pool.filter((c) => !DEFAULT_CHARS.includes(c))]
    : pool
        .map((c) => ({ c, w: weakness(stats[c]), r: rng() }))
        .sort((a, b) => b.w - a.w || a.r - b.r)
        .map((x) => x.c);
  return ordered.slice(0, size);
}
