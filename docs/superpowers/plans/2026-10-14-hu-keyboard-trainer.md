# symbolhu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Tauri desktop app (macOS, Apple Silicon) that drills Hungarian-layout symbols on a Mac keyboard, per `docs/superpowers/specs/2026-10-14-hu-keyboard-trainer-design.md`.

**Architecture:** A pure, unit-tested TypeScript game engine (`src/engine/`) drives Vue 3 screens. A Hungarian layout map, generated once from macOS with `UCKeyTranslate`, powers both the default pool and the on-screen key hints. Settings, statistics and game history live in one JSON store (`tauri-plugin-store`, with a `localStorage` fallback so `bun run dev` works in a plain browser).

**Tech Stack:** Tauri 2, Vue 3, Vite, TypeScript, Vitest, Bun, Swift (one-off layout generator).

**Verified facts this plan relies on** (all checked on this machine, arm64, Bun 1.4, Cargo 1.98, Swift 6.4, Hungarian input source enabled):
- `bun create tauri-app` works non-interactively with the flags used in Task 1.
- The npm package and the Rust crate of `tauri-plugin-store` must have the same major.minor, or `tauri build` aborts. Both are pinned to `2.5.0`.
- The shell's default npm registry here is a private CodeArtifact with expired credentials. Every `bun install` below passes `--registry https://registry.npmjs.org`. Drop that flag if your registry works.
- The generated layout maps `(` to Shift+9 key, `<` and `>` to Option+Shift on the `Y`/`X` positions, `*` to Option+Shift+`,` key.

**Deviation from the spec:** the "wrong input source" warning is triggered by the US-style `Y`/`Z` swap (the physical Y key typing `y`), not by "no pool character ever produced". It is simpler and reliable because the Hungarian layout swaps Y and Z. The spec is updated to match.

**Second deviation:** the hint is an HTML/CSS keyboard (flex rows), not an inline SVG. Same result, less code. The spec is updated to match.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `scripts/gen-layout.swift` | One-off generator: char -> `{keyCode, shift, option}` from the macOS Hungarian layout |
| `src/data/layout-hu-mac.json` | Generated output, committed |
| `src/layout.ts` | Typed access to the map, key labels, default pool |
| `src/engine/rules.ts` | Pure rules: queue building, round scoring, stats recording, weakness, next-game selection |
| `src/engine/session.ts` | `GameSession`: rounds, active characters, game end |
| `src/engine/settings.ts` | Settings/stats validation with safe fallbacks |
| `src/input/match.ts` | Pure keydown classification (hit / miss / ignore) and wrong-layout detection |
| `src/store.ts` | Load/save settings, stats, games (Tauri store or `localStorage`) |
| `src/components/KeyboardHint.vue` | SVG-free HTML/CSS MacBook ISO keyboard with highlighted keys |
| `src/components/Practice.vue` | The game screen: target char, countdown, hint, results |
| `src/components/Settings.vue` | Settings form |
| `src/components/Stats.vue` | Per-character table and game history |
| `src/App.vue` | Menu and screen switching |

Tests exist only for the pure modules (`rules`, `session`, `settings`, `match`), per the spec. UI is verified manually.

---

### Task 1: Scaffold the project

**Files:**
- Create (by the script, which lives in `/tmp`, not in the repo): `package.json`, `index.html`, `vite.config.ts`, `tsconfig*.json`, `src/main.ts`, `src-tauri/**`

The scaffolder derives the Rust crate name from the directory it runs in, so the script scaffolds in a temp dir under the name `symbolhu` and rsyncs the result into the repo.

- [ ] **Step 1: Write the setup script outside the repo**

Save this as `/tmp/symbolhu-setup.sh`:

```bash
set -euo pipefail
TMP=$(mktemp -d)
bun create tauri-app "$TMP/symbolhu" --template vue-ts --manager bun --identifier hu.symbol.trainer --yes </dev/null
rm "$TMP/symbolhu/README.md"
rsync -a --exclude node_modules --exclude .git "$TMP/symbolhu/" ./
rm -rf src/App.vue src/assets public/*.svg .vscode
sed -i '' '/vite.svg/d; s#<title>.*</title>#<title>symbolhu</title>#' index.html
python3 - <<'PY'
import re
t = open('src-tauri/Cargo.toml').read()
t = re.sub(r'^name = ".*_lib"$', 'name = "symbolhu_lib"', t, flags=re.M)
t = re.sub(r'^name = ".*"$', 'name = "symbolhu"', t, count=1, flags=re.M)
open('src-tauri/Cargo.toml', 'w').write(t)
m = open('src-tauri/src/main.rs').read()
open('src-tauri/src/main.rs', 'w').write(re.sub(r'\w+_lib::run', 'symbolhu_lib::run', m))
import json
p = json.load(open('package.json'))
p['name'] = 'symbolhu'
p['scripts']['test'] = 'vitest run'
p['dependencies'].pop('@tauri-apps/plugin-opener', None)
p['dependencies']['@tauri-apps/plugin-store'] = '2.5.0'
p['devDependencies']['vitest'] = '^5.0.4'
json.dump(p, open('package.json', 'w'), indent=2); open('package.json', 'a').write('\n')

c = json.load(open('src-tauri/tauri.conf.json'))
c['productName'] = 'symbolhu'
c['app']['windows'][0].update(title='symbolhu', width=900, height=700)
c['bundle']['targets'] = ['app', 'dmg']
json.dump(c, open('src-tauri/tauri.conf.json', 'w'), indent=2); open('src-tauri/tauri.conf.json', 'a').write('\n')

c = json.load(open('src-tauri/capabilities/default.json'))
c['permissions'] = ['core:default', 'store:default']
json.dump(c, open('src-tauri/capabilities/default.json', 'w'), indent=2); open('src-tauri/capabilities/default.json', 'a').write('\n')

s = open('src-tauri/Cargo.toml').read()
s = s.replace('tauri-plugin-opener = "2"\n', 'tauri-plugin-store = "2.5.0"\n')
open('src-tauri/Cargo.toml', 'w').write(s)
PY
cat > src-tauri/src/lib.rs <<'RS'
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
RS
mkdir -p src/engine src/input src/components src/data scripts
echo ".DS_Store" >> .gitignore
bun install --registry https://registry.npmjs.org
```

- [ ] **Step 2: Run it from the repo root**

Run (from `/Users/gabor_esik/Git/GitHub/symbolhu`): `bash /tmp/symbolhu-setup.sh`
Expected: ends with `72 packages installed` (count may differ slightly). `src/` contains only `main.ts` and `vite-env.d.ts`.

- [ ] **Step 3: Check the generated names**

Run: `grep -n '^name' src-tauri/Cargo.toml && tail -3 src-tauri/src/main.rs`
Expected: `name = "symbolhu"`, `name = "symbolhu_lib"`, and `symbolhu_lib::run()`.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "chore: scaffold Tauri 2 + Vue 3 + Vitest project"
```


### Task 2: Hungarian layout map

**Files:**
- Create: `scripts/gen-layout.swift`
- Create (generated): `src/data/layout-hu-mac.json`
- Create: `src/layout.ts`

Requires the Hungarian keyboard to be enabled in System Settings -> Keyboard -> Input Sources.

- [ ] **Step 1: Create `scripts/gen-layout.swift`**

```swift
// Generates src/data/layout-hu-mac.json from the macOS "Hungarian" input source.
// Run: swiftc -O scripts/gen-layout.swift -o /tmp/gen-layout && /tmp/gen-layout > src/data/layout-hu-mac.json
import Carbon
import Foundation

let filter = [kTISPropertyInputSourceID as String: "com.apple.keylayout.Hungarian"] as CFDictionary
guard let list = TISCreateInputSourceList(filter, true)?.takeRetainedValue() as? [TISInputSource],
      let src = list.first,
      let ptr = TISGetInputSourceProperty(src, kTISPropertyUnicodeKeyLayoutData) else {
    FileHandle.standardError.write("Hungarian layout not found\n".data(using: .utf8)!)
    exit(1)
}
let data = Unmanaged<CFData>.fromOpaque(ptr).takeUnretainedValue() as Data
let kbType = UInt32(LMGetKbdType())

struct Entry: Codable { let keyCode: Int; let shift: Bool; let option: Bool }
var map: [String: Entry] = [:]
// fewest modifiers wins: none < shift < option < shift+option
let combos: [(Bool, Bool)] = [(false, false), (true, false), (false, true), (true, true)]
let skip: Set<Int> = [36, 48, 49]  // return, tab, space

data.withUnsafeBytes { raw in
    let layout = raw.baseAddress!.assumingMemoryBound(to: UCKeyboardLayout.self)
    for (shift, option) in combos {
        var mods: UInt32 = 0
        if shift { mods |= UInt32(shiftKey >> 8) }
        if option { mods |= UInt32(optionKey >> 8) }
        for code in 0...50 where !skip.contains(code) {
            var dead: UInt32 = 0
            var len = 0
            var chars = [UniChar](repeating: 0, count: 4)
            // dead-key aware pass: a dead key produces no character in the browser ("Dead")
            let r = UCKeyTranslate(layout, UInt16(code), UInt16(kUCKeyActionDown), mods, kbType,
                                   0, &dead, 4, &len, &chars)
            guard r == noErr, dead == 0, len == 1 else { continue }
            let s = String(utf16CodeUnits: chars, count: len)
            guard let u = s.unicodeScalars.first, u.value > 32, u.value != 127 else { continue }
            if map[s] == nil { map[s] = Entry(keyCode: code, shift: shift, option: option) }
        }
    }
}
let enc = JSONEncoder()
enc.outputFormatting = [.prettyPrinted, .sortedKeys]
print(String(data: try enc.encode(map), encoding: .utf8)!)
```

- [ ] **Step 2: Generate the map**

Run:
```bash
swiftc -O scripts/gen-layout.swift -o /tmp/gen-layout && /tmp/gen-layout > src/data/layout-hu-mac.json
```
Expected: no output, exit 0 (a `Hungarian layout not found` error means the input source is not enabled).

- [ ] **Step 3: Sanity-check the map**

Run:
```bash
python3 - <<'EOF'
import json
m = json.load(open('src/data/layout-hu-mac.json'))
assert len(m) == 180, len(m)
for ch in '<>*()':
    assert ch in m, ch
assert m['('] == {'keyCode': 28, 'option': False, 'shift': True}
assert m['<']['option'] and m['<']['shift']
print('ok', len(m))
EOF
```
Expected: `ok 180`.

- [ ] **Step 4: Create `src/layout.ts`**

```ts
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
```

- [ ] **Step 5: Commit**

```bash
git add scripts/gen-layout.swift src/data/layout-hu-mac.json src/layout.ts
git commit -m "feat: generate Hungarian Mac layout map"
```


### Task 3: Round rules

**Files:**
- Create: `src/engine/rules.test.ts`
- Create: `src/engine/rules.ts`

Pure functions only. `buildQueue` shuffles with a forced-pick rule so the same character is never asked twice in a row (a character holding more than half of the remaining asks is picked immediately). `pickGameChars` uses the default list when no pool character has history, otherwise the weakest first (miss rate over the last 30 asks; unseen = 0.5; ties random).

- [ ] **Step 1: Create `src/engine/rules.test.ts`**

```ts
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
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `bunx vitest run src/engine/rules.test.ts`
Expected: FAIL, `Failed to resolve import` for `rules`.

- [ ] **Step 3: Create `src/engine/rules.ts`**

```ts
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
```

- [ ] **Step 4: Run the test, confirm it passes**

Run: `bunx vitest run src/engine/rules.test.ts`
Expected: all tests in the file pass (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/rules.test.ts src/engine/rules.ts
git commit -m "feat: round rules"
```


### Task 4: Game session

**Files:**
- Create: `src/engine/session.test.ts`
- Create: `src/engine/session.ts`

`GameSession` encodes the agreed rules: each round asks every active char `hitsPerChar` times; a char with all hits is mastered and leaves; the game ends when nobody is left or `maxRounds` is reached. The first test replays the example from the spec (15, 9, 6 asks).

- [ ] **Step 1: Create `src/engine/session.test.ts`**

```ts
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
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `bunx vitest run src/engine/session.test.ts`
Expected: FAIL, `Failed to resolve import` for `session`.

- [ ] **Step 3: Create `src/engine/session.ts`**

```ts
import { buildQueue, scoreRound, type Ask, type Rng, type RoundRecord } from "./rules";

/** One game: rounds of asks over the still-active characters. No timers, no DOM. */
export class GameSession {
  active: string[];
  round = 1;
  queue: string[];
  asks: Ask[] = []; // answers of the current round
  allAsks: Ask[] = []; // answers of the whole game
  rounds: RoundRecord[] = [];
  over: boolean;
  hitsPerChar: number;
  maxRounds: number;
  rng: Rng;

  constructor(cfg: { hitsPerChar: number; maxRounds: number }, readonly chars: string[], rng: Rng = Math.random) {
    this.hitsPerChar = cfg.hitsPerChar;
    this.maxRounds = cfg.maxRounds;
    this.rng = rng;
    this.active = [...chars];
    this.queue = buildQueue(this.active, this.hitsPerChar, rng);
    this.over = chars.length === 0;
  }

  get current(): string | undefined {
    return this.over ? undefined : this.queue[this.asks.length];
  }

  get mastered(): string[] {
    return this.rounds.flatMap((r) => r.mastered);
  }

  answer(hit: boolean): void {
    const char = this.current;
    if (char === undefined) return;
    const ask = { char, hit };
    this.asks.push(ask);
    this.allAsks.push(ask);
    if (this.asks.length === this.queue.length) this.endRound();
  }

  private endRound(): void {
    const rec = scoreRound(this.asks, this.active, this.hitsPerChar);
    this.rounds.push(rec);
    this.active = this.active.filter((c) => !rec.mastered.includes(c));
    if (this.active.length === 0 || this.round >= this.maxRounds) {
      this.over = true;
      return;
    }
    this.round++;
    this.asks = [];
    this.queue = buildQueue(this.active, this.hitsPerChar, this.rng);
  }
}
```

- [ ] **Step 4: Run the test, confirm it passes**

Run: `bunx vitest run src/engine/session.test.ts`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/session.test.ts src/engine/session.ts
git commit -m "feat: game session"
```


### Task 5: Settings and stats validation

**Files:**
- Create: `src/engine/settings.test.ts`
- Create: `src/engine/settings.ts`

Anything read from disk or typed in the form passes through these sanitizers, which never throw and fall back to defaults (timeout 3 s, 3 hits, game size 5, 10 rounds).

- [ ] **Step 1: Create `src/engine/settings.test.ts`**

```ts
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
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `bunx vitest run src/engine/settings.test.ts`
Expected: FAIL, `Failed to resolve import` for `settings`.

- [ ] **Step 3: Create `src/engine/settings.ts`**

```ts
import { RECENT, type CharStats, type StatsMap } from "./rules";

export interface Settings {
  pool: string[];
  gameSize: number;
  timeoutSec: number;
  hitsPerChar: number;
  maxRounds: number;
}

export const DEFAULTS = { gameSize: 5, timeoutSec: 3, hitsPerChar: 3, maxRounds: 10 };

const posInt = (v: unknown, d: number) => (Number.isInteger(v) && (v as number) >= 1 ? (v as number) : d);

/** Never throws: anything invalid falls back to a default. */
export function sanitizeSettings(raw: unknown, known: (c: string) => boolean, defaultPool: string[]): Settings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const pool = Array.isArray(r.pool)
    ? [...new Set(r.pool.filter((c): c is string => typeof c === "string" && Array.from(c).length === 1 && known(c)))]
    : [];
  return {
    pool: pool.length ? pool : defaultPool,
    gameSize: posInt(r.gameSize, DEFAULTS.gameSize),
    timeoutSec: typeof r.timeoutSec === "number" && r.timeoutSec > 0 ? r.timeoutSec : DEFAULTS.timeoutSec,
    hitsPerChar: posInt(r.hitsPerChar, DEFAULTS.hitsPerChar),
    maxRounds: posInt(r.maxRounds, DEFAULTS.maxRounds),
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
```

- [ ] **Step 4: Run the test, confirm it passes**

Run: `bunx vitest run src/engine/settings.test.ts`
Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/settings.test.ts src/engine/settings.ts
git commit -m "feat: settings and stats validation"
```


### Task 6: Key matching

**Files:**
- Create: `src/input/match.test.ts`
- Create: `src/input/match.ts`

Classifies a keydown as `hit`, `miss` or `ignore`. Modifier-only presses, `Dead`, named keys, Cmd/Ctrl combos and key repeat are ignored. Also detects a US-style layout via the Y/Z swap.

- [ ] **Step 1: Create `src/input/match.test.ts`**

```ts
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
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `bunx vitest run src/input/match.test.ts`
Expected: FAIL, `Failed to resolve import` for `match`.

- [ ] **Step 3: Create `src/input/match.ts`**

```ts
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
```

- [ ] **Step 4: Run the test, confirm it passes**

Run: `bunx vitest run src/input/match.test.ts`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/input/match.test.ts src/input/match.ts
git commit -m "feat: key matching"
```


### Task 7: Persistence

**Files:**
- Create: `src/store.ts`

Uses `tauri-plugin-store` inside Tauri and `localStorage` in a plain browser. Not unit-tested (thin I/O wrapper); exercised in Task 11.

- [ ] **Step 1: Create `src/store.ts`**

```ts
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
    return { get: (k: string) => s.get<unknown>(k), set: (k: string, v: unknown) => s.set(k, v) };
  }
  // plain browser (bun run dev without Tauri): localStorage
  return {
    get: async (k: string) => JSON.parse(localStorage.getItem(`${FILE}:${k}`) ?? "null") as unknown,
    set: async (k: string, v: unknown) => localStorage.setItem(`${FILE}:${k}`, JSON.stringify(v)),
  };
}

const known = (c: string) => c in layout;

export async function loadData(): Promise<Data> {
  const b = await backend();
  const games = await b.get("games");
  return {
    settings: sanitizeSettings(await b.get("settings"), known, defaultPool()),
    stats: sanitizeStats(await b.get("stats")),
    games: Array.isArray(games) ? (games as GameRecord[]) : [],
  };
}

export async function saveData(d: Data): Promise<void> {
  const b = await backend();
  await b.set("settings", d.settings);
  await b.set("stats", d.stats);
  await b.set("games", d.games);
}
```

- [ ] **Step 2: Wire the Rust side**

Confirm `src-tauri/src/lib.rs` registers the plugin and `src-tauri/capabilities/default.json` has `store:default` (both done by the setup script). Run: `cd src-tauri && cargo check`
Expected: `Finished` with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/store.ts
git commit -m "feat: persist settings, stats and games"
```


### Task 8: Keyboard hint component

**Files:**
- Create: `src/components/KeyboardHint.vue`

An HTML/CSS MacBook ISO keyboard (not an SVG: flex rows are simpler and scale the same). It highlights the physical key and, when needed, Shift (key 56) and Option (key 58), and prints the recipe above it, e.g. `Shift + Option + X`.

- [ ] **Step 1: Create `src/components/KeyboardHint.vue`**

```vue
<script setup lang="ts">
import { computed } from "vue";
import { baseLabels, layout } from "../layout";

const props = defineProps<{ char: string }>();

interface Key { code: number; label?: string; w?: number }
const k = (code: number, label?: string, w = 1): Key => ({ code, label, w });
const rows: Key[][] = [
  [10, 18, 19, 20, 21, 23, 22, 26, 28, 25, 29, 27, 24].map((c) => k(c)).concat(k(51, "⌫", 1.6)),
  [k(48, "⇥", 1.5), ...[12, 13, 14, 15, 17, 16, 32, 34, 31, 35, 33, 30].map((c) => k(c)), k(-1, "", 1)],
  [k(57, "⇪", 1.8), ...[0, 1, 2, 3, 5, 4, 38, 40, 37, 41, 39, 42].map((c) => k(c)), k(36, "⏎", 1.4)],
  [k(56, "⇧", 1.3), ...[50, 6, 7, 8, 9, 11, 45, 46, 43, 47, 44].map((c) => k(c)), k(60, "⇧", 2.3)],
  [k(63, "fn"), k(59, "⌃"), k(58, "⌥", 1.2), k(55, "⌘", 1.4), k(49, "", 5), k(54, "⌘", 1.4), k(61, "⌥", 1.2)],
];

const combo = computed(() => layout[props.char]);
const lit = computed(() => {
  const c = combo.value;
  if (!c) return new Set<number>();
  const s = new Set([c.keyCode]);
  if (c.shift) s.add(56);
  if (c.option) s.add(58);
  return s;
});
const recipe = computed(() => {
  const c = combo.value;
  if (!c) return "";
  const keyName = baseLabels[c.keyCode] ?? `key ${c.keyCode}`;
  return [c.shift && "⇧ Shift", c.option && "⌥ Option", keyName].filter(Boolean).join(" + ");
});
</script>

<template>
  <div class="hint">
    <div v-if="combo" class="recipe">{{ recipe }}</div>
    <div v-else class="recipe">No key on the Hungarian layout produces “{{ char }}”</div>
    <div class="kb">
      <div v-for="(row, i) in rows" :key="i" class="row">
        <div
          v-for="(key, j) in row"
          :key="j"
          class="key"
          :class="{ lit: lit.has(key.code), ghost: key.code === -1 }"
          :style="{ flex: `${key.w} 1 0` }"
        >{{ key.label ?? baseLabels[key.code] }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.recipe { font-size: 1.6rem; font-weight: 600; margin-bottom: 0.8rem; }
.kb { display: flex; flex-direction: column; gap: 4px; width: 100%; max-width: 640px; margin: 0 auto; }
.row { display: flex; gap: 4px; }
.key {
  height: 42px; display: flex; align-items: center; justify-content: center;
  border: 1px solid #888; border-radius: 6px; background: #2a2a2e; color: #ddd; font-size: 0.9rem;
}
.key.ghost { visibility: hidden; }
.key.lit { background: #f5a623; color: #000; border-color: #f5a623; font-weight: 700; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/KeyboardHint.vue
git commit -m "feat: keyboard hint component"
```


### Task 9: Practice screen

**Files:**
- Create: `src/components/Practice.vue`

Flow: `ask` phase (countdown bar, `timeoutSec` timer) -> correct key = hit and next ask; wrong key or timeout = miss and `hint` phase; in `hint` the hint stays until the correct key is pressed. When the session is over it emits `finished` with the game record and updated stats.

- [ ] **Step 1: Create `src/components/Practice.vue`**

```vue
<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { GameSession } from "../engine/session";
import { pickGameChars, recordResults, type GameRecord, type StatsMap } from "../engine/rules";
import type { Settings } from "../engine/settings";
import { keyOutcome, looksNonHungarian } from "../input/match";
import KeyboardHint from "./KeyboardHint.vue";

const props = defineProps<{ settings: Settings; stats: StatsMap }>();
const emit = defineEmits<{ finished: [game: GameRecord, stats: StatsMap]; quit: [] }>();

const chars = pickGameChars(props.settings.pool, props.stats, props.settings.gameSize);
const s = reactive(new GameSession(props.settings, chars));
const phase = ref<"ask" | "hint" | "over">("ask");
const hintChar = ref("");
const barKey = ref(0);
const wrongLayout = ref(false);
let timer: number | undefined;

function startAsk() {
  clearTimeout(timer);
  barKey.value++;
  timer = window.setTimeout(() => answer(false), props.settings.timeoutSec * 1000);
}

function next() {
  if (s.over) {
    phase.value = "over";
    emit("finished", { date: new Date().toISOString(), chars, rounds: [...s.rounds] }, recordResults(props.stats, s.allAsks, s.mastered));
  } else {
    phase.value = "ask";
    startAsk();
  }
}

function answer(hit: boolean) {
  clearTimeout(timer);
  const c = s.current!;
  s.answer(hit);
  if (hit) return next();
  hintChar.value = c;
  phase.value = "hint";
}

function onKey(e: KeyboardEvent) {
  if (phase.value === "over") return;
  if (looksNonHungarian(e)) wrongLayout.value = true;
  const target = phase.value === "hint" ? hintChar.value : s.current!;
  const o = keyOutcome(e, target);
  if (o === "ignore") return;
  e.preventDefault();
  if (phase.value === "hint") {
    if (o === "hit") next();
  } else answer(o === "hit");
}

onMounted(() => {
  window.addEventListener("keydown", onKey);
  if (s.over) phase.value = "over";
  else startAsk();
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKey);
  clearTimeout(timer);
});
</script>

<template>
  <section class="practice">
    <p v-if="wrongLayout" class="warn">
      Y/Z look swapped the US way. Is the Hungarian input source active? (menu bar → input source → Hungarian)
    </p>

    <template v-if="phase !== 'over'">
      <div class="meta">Round {{ s.round }}/{{ settings.maxRounds }} · ask {{ s.asks.length + (phase === "hint" ? 0 : 1) }}/{{ s.queue.length }}</div>
      <div class="char">{{ phase === "hint" ? hintChar : s.current }}</div>
      <div v-if="phase === 'ask'" class="bar"><div :key="barKey" class="fill" :style="{ animationDuration: settings.timeoutSec + 's' }" /></div>
      <template v-else>
        <KeyboardHint :char="hintChar" />
        <p class="muted">Now press it to continue</p>
      </template>
    </template>

    <template v-else>
      <h2>Game finished</h2>
      <ul>
        <li v-for="(r, i) in s.rounds" :key="i">
          Round {{ i + 1 }}: asked {{ r.asked.join(" ") }} → mastered {{ r.mastered.join(" ") || "none" }}
        </li>
      </ul>
      <p v-if="s.active.length">Still weak: {{ s.active.join(" ") }}</p>
    </template>

    <button @click="emit('quit')">{{ phase === "over" ? "Back" : "Quit game" }}</button>
  </section>
</template>

<style scoped>
.practice { text-align: center; }
.char { font-size: 9rem; line-height: 1.2; font-weight: 700; }
.meta, .muted { color: #999; }
.warn { background: #5a3b00; padding: 0.6rem; border-radius: 6px; }
.bar { height: 8px; background: #333; border-radius: 4px; overflow: hidden; margin: 1rem auto 2rem; max-width: 400px; }
.fill { height: 100%; background: #f5a623; transform-origin: left; animation: shrink linear forwards; }
@keyframes shrink { from { transform: scaleX(1); } to { transform: scaleX(0); } }
ul { list-style: none; padding: 0; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Practice.vue
git commit -m "feat: practice screen"
```


### Task 10: Settings and statistics screens

**Files:**
- Create: `src/components/Settings.vue`
- Create: `src/components/Stats.vue`

- [ ] **Step 1: Create `src/components/Settings.vue`**

```vue
<script setup lang="ts">
import { ref } from "vue";
import { defaultPool, layout } from "../layout";
import { sanitizeSettings, type Settings } from "../engine/settings";

const props = defineProps<{ settings: Settings }>();
const emit = defineEmits<{ save: [s: Settings]; cancel: [] }>();

const pool = ref(props.settings.pool.join(" "));
const gameSize = ref(props.settings.gameSize);
const timeoutSec = ref(props.settings.timeoutSec);
const hitsPerChar = ref(props.settings.hitsPerChar);
const maxRounds = ref(props.settings.maxRounds);

function save() {
  emit("save", sanitizeSettings(
    {
      pool: Array.from(pool.value.replace(/\s/g, "")),
      gameSize: gameSize.value,
      timeoutSec: timeoutSec.value,
      hitsPerChar: hitsPerChar.value,
      maxRounds: maxRounds.value,
    },
    (c) => c in layout,
    defaultPool(),
  ));
}
</script>

<template>
  <section class="settings">
    <h2>Settings</h2>
    <label>Characters to practise (pool)
      <textarea v-model="pool" rows="3" />
    </label>
    <button type="button" @click="pool = defaultPool().join(' ')">Reset pool to all layout symbols</button>
    <label>Characters per game <input v-model.number="gameSize" type="number" min="1" /></label>
    <label>Timeout (seconds) <input v-model.number="timeoutSec" type="number" min="0.5" step="0.5" /></label>
    <label>Hits per character per round <input v-model.number="hitsPerChar" type="number" min="1" /></label>
    <label>Max rounds <input v-model.number="maxRounds" type="number" min="1" /></label>
    <p class="muted">Invalid values and characters not on the Hungarian layout are replaced by defaults / dropped.</p>
    <div class="actions"><button @click="save">Save</button><button @click="emit('cancel')">Cancel</button></div>
  </section>
</template>

<style scoped>
.settings { display: flex; flex-direction: column; gap: 0.8rem; max-width: 480px; margin: 0 auto; }
label { display: flex; flex-direction: column; gap: 0.3rem; }
textarea { font-size: 1.3rem; letter-spacing: 0.2em; }
.muted { color: #999; font-size: 0.85rem; }
.actions { display: flex; gap: 0.6rem; }
</style>
```

- [ ] **Step 2: Create `src/components/Stats.vue`**

```vue
<script setup lang="ts">
import { computed } from "vue";
import { weakness, type GameRecord, type StatsMap } from "../engine/rules";

const props = defineProps<{ stats: StatsMap; games: GameRecord[] }>();
defineEmits<{ back: [] }>();

const rows = computed(() =>
  Object.entries(props.stats)
    .map(([c, s]) => ({ c, ...s, miss: Math.round(weakness(s) * 100) }))
    .sort((a, b) => b.miss - a.miss),
);
const games = computed(() => [...props.games].reverse());
</script>

<template>
  <section class="stats">
    <h2>Statistics</h2>
    <p v-if="!rows.length">No games played yet.</p>
    <table v-else>
      <thead><tr><th>Char</th><th>Asks</th><th>Hits</th><th>Recent miss %</th><th>Times mastered</th></tr></thead>
      <tbody>
        <tr v-for="r in rows" :key="r.c">
          <td class="c">{{ r.c }}</td><td>{{ r.asks }}</td><td>{{ r.hits }}</td><td>{{ r.miss }}</td><td>{{ r.masteredCount }}</td>
        </tr>
      </tbody>
    </table>
    <h3>Games</h3>
    <ul>
      <li v-for="g in games" :key="g.date">
        {{ new Date(g.date).toLocaleString() }} · {{ g.chars.join(" ") }} · {{ g.rounds.length }} rounds ·
        mastered {{ g.rounds.reduce((n, r) => n + r.mastered.length, 0) }}/{{ g.chars.length }}
      </li>
    </ul>
    <button @click="$emit('back')">Back</button>
  </section>
</template>

<style scoped>
table { border-collapse: collapse; margin: 0 auto 1rem; }
th, td { padding: 0.3rem 0.9rem; text-align: center; border-bottom: 1px solid #444; }
.c { font-size: 1.4rem; font-weight: 700; }
ul { list-style: none; padding: 0; }
</style>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Settings.vue src/components/Stats.vue
git commit -m "feat: settings and statistics screens"
```


### Task 11: App shell and browser verification

**Files:**
- Create: `src/App.vue`

- [ ] **Step 1: Create `src/App.vue`**

```vue
<script setup lang="ts">
import { onMounted, ref } from "vue";
import Practice from "./components/Practice.vue";
import Settings from "./components/Settings.vue";
import Stats from "./components/Stats.vue";
import { loadData, saveData, type Data } from "./store";
import type { GameRecord, StatsMap } from "./engine/rules";
import type { Settings as SettingsT } from "./engine/settings";

const data = ref<Data>();
const screen = ref<"menu" | "practice" | "settings" | "stats">("menu");
const gameId = ref(0);

onMounted(async () => (data.value = await loadData()));

function start() {
  gameId.value++;
  screen.value = "practice";
}
async function onFinished(game: GameRecord, stats: StatsMap) {
  data.value = { ...data.value!, stats, games: [...data.value!.games, game] };
  await saveData(data.value);
}
async function onSaveSettings(settings: SettingsT) {
  data.value = { ...data.value!, settings };
  await saveData(data.value);
  screen.value = "menu";
}
</script>

<template>
  <main v-if="data">
    <div v-if="screen === 'menu'" class="menu">
      <h1>symbolhu</h1>
      <p>Practise Hungarian-layout symbols on a Mac keyboard.</p>
      <button class="primary" @click="start">Start game</button>
      <button @click="screen = 'stats'">Statistics</button>
      <button @click="screen = 'settings'">Settings</button>
    </div>
    <Practice v-else-if="screen === 'practice'" :key="gameId" :settings="data.settings" :stats="data.stats" @finished="onFinished" @quit="screen = 'menu'" />
    <Settings v-else-if="screen === 'settings'" :settings="data.settings" @save="onSaveSettings" @cancel="screen = 'menu'" />
    <Stats v-else :stats="data.stats" :games="data.games" @back="screen = 'menu'" />
  </main>
</template>

<style>
:root { color-scheme: dark; font-family: -apple-system, system-ui, sans-serif; background: #1c1c1e; color: #eee; }
body { margin: 0; }
main { padding: 1.5rem; min-height: 100vh; box-sizing: border-box; }
button { font: inherit; padding: 0.5rem 1.1rem; border-radius: 8px; border: 1px solid #666; background: #333; color: #eee; cursor: pointer; }
button.primary { background: #f5a623; color: #000; border-color: #f5a623; font-weight: 700; }
input, textarea { font: inherit; padding: 0.4rem; border-radius: 6px; border: 1px solid #666; background: #2a2a2e; color: #eee; }
.menu { display: flex; flex-direction: column; align-items: center; gap: 0.8rem; margin-top: 12vh; }
</style>
```

- [ ] **Step 2: Type-check and build the frontend**

Run: `bun run build`
Expected: `vue-tsc` clean and `built in ...ms`.

- [ ] **Step 3: Run all unit tests**

Run: `bun run test`
Expected: `Tests  21 passed (21)`.

- [ ] **Step 4: Play it in a browser**

Run: `bun run dev` and open `http://localhost:1420` (no Tauri needed, `localStorage` is used).

Check, in order:
1. Menu shows three buttons. **Start game** shows `Round 1/10 · ask 1/15` and a large character from `< > * ( )`.
2. Press a wrong key: the hint appears with a recipe (for `>` it reads `Shift + Option + X` with Shift, X and Option lit). Pressing the target character continues.
3. Wait 3 s without pressing: the same hint appears (timeout = miss).
4. Finish a game: the summary lists each round, the characters asked and the characters mastered; characters not mastered every time reappear in the next round only.
5. **Statistics** lists the characters with asks, hits, recent miss % and times mastered; reloading the page keeps them.
6. A second **Start game** now picks the weakest characters first.
7. **Settings**: change the timeout to 1.5 and the pool to `# @ |`, save, start a game: new values apply. Enter garbage (timeout `0`) and confirm it falls back to 3.

- [ ] **Step 5: Commit**

```bash
git add src/App.vue
git commit -m "feat: app shell"
```


### Task 12: Native build and wrap-up

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Build the macOS app**

Run: `bun run tauri build --debug --bundles app`
Expected: `Finished 1 bundle at: .../src-tauri/target/debug/bundle/macos/symbolhu.app`. (Use `bun run tauri build` without `--debug` for the release `.app` and `.dmg`.)

- [ ] **Step 2: Manual check of the real app on the MacBook keyboard**

Run: `open src-tauri/target/debug/bundle/macos/symbolhu.app`
Verify, with the Hungarian input source selected:
1. For each of `< > * ( )`, press the key combination shown in the hint; each must register as a hit. This is the check that the generated layout matches your physical keyboard.
2. Switch the input source to ABC (US) and start a game: pressing the physical Z/Y position triggers the "Is the Hungarian input source active?" banner.
3. Quit and reopen the app: statistics are still there (stored by `tauri-plugin-store`).

- [ ] **Step 3: Replace the README**

```markdown
# symbolhu

A small desktop trainer (Tauri 2 + Vue 3) for the symbols that are hard to find on a Hungarian Mac keyboard: `< > * ( )` and more.

## Develop

    bun install
    bun run dev            # browser only, localStorage
    bun run tauri dev      # native window
    bun run test           # unit tests
    bun run tauri build    # release .app and .dmg (Apple Silicon)

## Regenerate the layout map

Needs the Hungarian input source enabled:

    swiftc -O scripts/gen-layout.swift -o /tmp/gen-layout && /tmp/gen-layout > src/data/layout-hu-mac.json
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: usage"
```


---

## Self-review against the spec

| Spec section | Task |
|---|---|
| Game rules 1-7 (round = every char `hitsPerChar` times, mastery, next round only unmastered, game end) | 3, 4 (test replays the 15/9/6 example) |
| Wrong key = instant miss, timeout = miss, hint after a miss | 6, 9 |
| Next game selection (pool, weakest first, 0.5 for unseen, default list at start) | 3 |
| Layout map from `UCKeyTranslate`, committed | 2 |
| Keyboard hint with highlighted key + modifiers | 8 |
| Practice / Settings / Statistics screens | 9, 10 |
| JSON store, corrupt file falls back to defaults | 5, 7 |
| Settings validation | 5 |
| Wrong-input-source notice | 6, 9 (Y/Z heuristic, see deviation) |
| Tauri macOS arm64 build | 12 |

Known limits (accepted): the native window was launched but not clicked through by automation (macOS blocks assistive access), so Task 12 Step 2 is a manual check; the Hungarian layout must be enabled to regenerate the map; characters needing dead keys are excluded from the map.
