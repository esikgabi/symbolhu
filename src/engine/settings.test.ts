import { describe, expect, it } from "vitest";
import { sanitizeSettings, sanitizeStats } from "./settings";

const known = (c: string) => "<>*()#".includes(c);
const dflt = ["<", ">"];

describe("sanitizeSettings", () => {
  it("falls back to defaults for garbage", () => {
    for (const bad of [null, undefined, 42, "x", []]) {
      expect(sanitizeSettings(bad, known, dflt)).toEqual({
        pool: dflt, gameSize: 5, timeoutSec: 3, hitsPerChar: 3, maxRounds: 10,
      });
    }
  });

  it("keeps valid values, drops unknown/multi-char/duplicate pool entries", () => {
    const s = sanitizeSettings(
      { pool: ["#", "#", "ab", "q", 5, "*"], gameSize: 2, timeoutSec: 1.5, hitsPerChar: 0, maxRounds: 4 },
      known, dflt,
    );
    expect(s).toEqual({ pool: ["#", "*"], gameSize: 2, timeoutSec: 1.5, hitsPerChar: 3, maxRounds: 4 });
  });

  it("rejects non-positive timeout", () => {
    expect(sanitizeSettings({ timeoutSec: 0 }, known, dflt).timeoutSec).toBe(3);
  });

  it("rejects absurdly large values", () => {
    const s = sanitizeSettings({ timeoutSec: 1e9, hitsPerChar: 1e9, gameSize: 1e9, maxRounds: 1e9 }, known, dflt);
    expect([s.timeoutSec, s.hitsPerChar, s.gameSize, s.maxRounds]).toEqual([3, 3, 5, 10]);
  });
});

describe("sanitizeStats", () => {
  it("drops corrupt entries and keeps good ones", () => {
    const out = sanitizeStats({ a: { recent: [true, "x", false], asks: 3, hits: 1, masteredCount: 0 }, b: 7, c: { recent: "no" } });
    expect(Object.keys(out)).toEqual(["a"]);
    expect(out.a.recent).toEqual([true, false]);
  });
  it("handles non-objects", () => {
    expect(sanitizeStats(null)).toEqual({});
  });
});
