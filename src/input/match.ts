export type Outcome = "ignore" | "hit" | "miss";

export interface KeyLike {
  key: string;
  code?: string;
  altKey?: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
  repeat?: boolean;
}

/** Named keys (Shift, Dead, Enter...) have key.length > 1 and are ignored, as are Cmd/Ctrl combos and key repeat. */
export function keyOutcome(e: KeyLike, target: string): Outcome {
  if (e.repeat || e.metaKey || e.ctrlKey || e.key.length !== 1) return "ignore";
  return e.key === target ? "hit" : "miss";
}

/** On the Hungarian layout the physical Y key types "z" and the physical Z key types "y". */
export function looksNonHungarian(e: KeyLike): boolean {
  if (e.altKey || e.key.length !== 1) return false;
  return (e.code === "KeyY" && e.key.toLowerCase() === "y") || (e.code === "KeyZ" && e.key.toLowerCase() === "z");
}
