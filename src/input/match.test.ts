import { describe, expect, it } from "vitest";
import { keyOutcome, looksNonHungarian } from "./match";

describe("keyOutcome", () => {
  it("hit / miss on printable keys", () => {
    expect(keyOutcome({ key: "<" }, "<")).toBe("hit");
    expect(keyOutcome({ key: "x" }, "<")).toBe("miss");
  });
  it("ignores modifiers, dead keys, named keys, Cmd/Ctrl combos and repeats", () => {
    for (const key of ["Shift", "Alt", "Dead", "Enter", "Meta"]) expect(keyOutcome({ key }, "<")).toBe("ignore");
    expect(keyOutcome({ key: "<", metaKey: true }, "<")).toBe("ignore");
    expect(keyOutcome({ key: "<", ctrlKey: true }, "<")).toBe("ignore");
    expect(keyOutcome({ key: "<", repeat: true }, "<")).toBe("ignore");
  });
});

describe("looksNonHungarian", () => {
  it("flags US-style Y/Z", () => {
    expect(looksNonHungarian({ key: "y", code: "KeyY" })).toBe(true);
    expect(looksNonHungarian({ key: "z", code: "KeyZ" })).toBe(true);
  });
  it("accepts Hungarian Y/Z and ignores Option combos", () => {
    expect(looksNonHungarian({ key: "z", code: "KeyY" })).toBe(false);
    expect(looksNonHungarian({ key: "y", code: "KeyZ" })).toBe(false);
    expect(looksNonHungarian({ key: "y", code: "KeyY", altKey: true })).toBe(false);
  });
});
