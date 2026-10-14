import { describe, expect, it } from "vitest";
import {
  buildQueue, DEFAULT_CHARS, pickGameChars, RECENT, recordResults, scoreRound, weakness, type Ask,
} from "./rules";

const seeded = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

describe("buildQueue", () => {
  it("asks every char exactly `times` times", () => {
    const q = buildQueue(["a", "b", "c", "d", "e"], 3, seeded(1));
    expect(q).toHaveLength(15);
    for (const c of "abcde") expect(q.filter((x) => x === c)).toHaveLength(3);
  });

  it("never repeats a char back to back when avoidable", () => {
    for (let seed = 1; seed <= 200; seed++) {
      for (const n of [2, 3, 5]) {
        for (const times of [1, 3, 10]) {
          const chars = "abcde".slice(0, n).split("");
          const q = buildQueue(chars, times, seeded(seed));
          q.forEach((c, i) => i > 0 && expect(c).not.toBe(q[i - 1]));
        }
      }
    }
  });

  it("copes with a single char", () => {
    expect(buildQueue(["a"], 3)).toEqual(["a", "a", "a"]);
  });
});

describe("scoreRound", () => {
  const asks = (s: string): Ask[] => s.split(" ").map((p) => ({ char: p[0], hit: p[1] === "+" }));
  it("masters only chars with all hits", () => {
    const r = scoreRound(asks("a+ a+ a+ b+ b- b+"), ["a", "b"], 3);
    expect(r.mastered).toEqual(["a"]);
    expect(r.asked).toEqual(["a", "b"]);
  });
});

describe("recordResults", () => {
  it("counts asks, hits, recent and mastery without mutating input", () => {
    const before = {};
    const after = recordResults(before, [{ char: "a", hit: true }, { char: "a", hit: false }], ["a"]);
    expect(before).toEqual({});
    expect(after.a).toEqual({ recent: [true, false], asks: 2, hits: 1, masteredCount: 1 });
  });
  it("keeps only the last RECENT results", () => {
    const asks = Array.from({ length: RECENT + 5 }, () => ({ char: "a", hit: true }));
    expect(recordResults({}, asks, []).a.recent).toHaveLength(RECENT);
  });
});

describe("weakness", () => {
  it("is 0.5 for unseen and the miss rate otherwise", () => {
    expect(weakness(undefined)).toBe(0.5);
    expect(weakness({ recent: [true, false, false, true], asks: 4, hits: 2, masteredCount: 0 })).toBe(0.5);
    expect(weakness({ recent: [true, true], asks: 2, hits: 2, masteredCount: 0 })).toBe(0);
  });
});

describe("pickGameChars", () => {
  const pool = ["<", ">", "*", "(", ")", "#", "@", "|"];
  const st = (recent: boolean[]) => ({ recent, asks: recent.length, hits: 0, masteredCount: 0 });

  it("uses the default list when there is no history", () => {
    expect(pickGameChars(pool, {}, 5).sort()).toEqual([...DEFAULT_CHARS].sort());
  });

  it("takes the weakest first, unseen next, strong last", () => {
    const stats = { "#": st([false, false]), "@": st([true, true]), "|": st([false, true]), "<": st([true]) };
    const picked = pickGameChars(pool, stats, 3, seeded(7));
    expect(picked[0]).toBe("#");
    expect(picked).not.toContain("@");
  });
});
