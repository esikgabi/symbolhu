import { describe, expect, it } from "vitest";
import { GameSession } from "./session";

const cfg = { hitsPerChar: 3, maxRounds: 10 };

/** Plays a session; `miss` decides per char whether that char fails in the given round. */
function play(s: GameSession, miss: (c: string, round: number) => boolean) {
  const asked: string[][] = [];
  while (!s.over) {
    (asked[s.round - 1] ??= []).push(s.current!);
    s.answer(!miss(s.current!, s.round));
  }
  return asked;
}

describe("GameSession", () => {
  it("plays the example from the spec", () => {
    const s = new GameSession(cfg, ["(", "<", ">", ")", "*"]);
    const asked = play(s, (c, r) => (r === 1 ? ["(", "<", ">"].includes(c) : r === 2 ? ["<", ">"].includes(c) : false));
    expect(asked.map((a) => a.length)).toEqual([15, 9, 6]);
    expect(new Set(asked[1])).toEqual(new Set(["(", "<", ">"]));
    expect(new Set(asked[2])).toEqual(new Set(["<", ">"]));
    expect(s.rounds.map((r) => r.mastered.sort())).toEqual([[")", "*"], ["("], ["<", ">"]]);
    expect(s.over).toBe(true);
    expect(s.allAsks).toHaveLength(30);
  });

  it("stops at maxRounds even if chars remain", () => {
    const s = new GameSession({ hitsPerChar: 3, maxRounds: 2 }, ["a", "b"]);
    play(s, () => true);
    expect(s.rounds).toHaveLength(2);
    expect(s.mastered).toEqual([]);
  });

  it("is over immediately with no chars", () => {
    expect(new GameSession(cfg, []).over).toBe(true);
  });
});
