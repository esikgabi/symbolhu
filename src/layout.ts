import raw from "./data/layout-hu-mac.json";

export interface Combo {
  keyCode: number;
  shift: boolean;
  option: boolean;
}

export const layout: Record<string, Combo> = raw;

// keyCode -> unshifted character (used to label the keyboard hint)
export const baseLabels: Record<number, string> = {};
for (const [ch, c] of Object.entries(layout)) {
  if (!c.shift && !c.option) baseLabels[c.keyCode] = ch.toUpperCase();
}

// Every non-letter, non-digit symbol that needs Shift or Option.
export function defaultPool(): string[] {
  return Object.entries(layout)
    .filter(([ch, c]) => (c.shift || c.option) && !/[\p{L}\p{N}]/u.test(ch))
    .map(([ch]) => ch)
    .sort();
}
