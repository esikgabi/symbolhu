# symbolhu: Hungarian Mac Keyboard Symbol Trainer - Design

## Purpose

A desktop app (macOS, Apple Silicon) to practise typing symbols that are hard to find on a Hungarian Mac keyboard (`<`, `>`, `*`, `(`, `)` ...). Target user: someone used to a Windows/Linux Hungarian layout, where these keys are labelled. Built-in MacBook ISO keyboard only.

## Tech stack

- Tauri 2 (Rust shell) + Vue 3 (Composition API) + Vite + TypeScript
- Vitest for tests, Bun as package manager, vanilla CSS
- Storage: JSON file via `tauri-plugin-store`
- No Pinia unless state handling becomes awkward

## Game rules

1. A **game** uses N characters (`gameSize`, default 5). The first game uses the default list `< > * ( )`.
2. A **round** asks every active character exactly `hitsPerChar` times (default 3). With 5 characters that is 15 asks, shuffled so the same character never appears twice in a row.
3. An ask is a **hit** if the pressed key produces the target character before `timeoutSec` (default 3) elapses.
4. An ask is a **miss** if the key is wrong (instant miss) or the timeout elapses. A miss shows the hint. Nothing is re-queued.
5. A character with `hitsPerChar` hits out of `hitsPerChar` asks in a round is **mastered**. It is recorded in the statistics and excluded from the following rounds of this game.
6. Any other character stays active for the next round.
7. The game ends when no active characters remain or `maxRounds` is reached (default 10).

Example (from the user): round 1 with `( < > ) *`, `*` and `)` perfect; round 2 asks `( < >`, `(` perfect; round 3 asks `< >`, both perfect; game finished.

### Next game selection

- A **pool** of candidate characters (settings, editable). Default: all symbols on the Hungarian Mac layout that need Shift or Option.
- The new game takes the `gameSize` characters with the highest weakness score.
- Weakness score = miss rate over the character's last 30 asks. No history scores 0.5, so unseen characters come after clearly weak ones. Ties are broken randomly.
- With no history at all, the game uses the default list.

## Components

### Round engine (`src/engine/`)
Pure TypeScript, no DOM and no timers. Input: settings and per-character history. Output: the ask queue, result recording, mastered and active sets, and next-round and next-game selection. This is the only part with unit tests (queue size and no immediate repeats, hit and miss handling, mastery, round filtering, game end, weakness ranking).

### Key matching (`src/input/`)
A `keydown` listener compares `event.key` with the target character. Modifier-only presses are ignored. `event.key === "Dead"` is ignored (dead keys are out of scope). The timer is a small wrapper in the practice component.

### Layout map (`src/data/layout-hu-mac.json`)
Maps character to `{ keyCode, shift, option }`. Generated once by a script that runs `UCKeyTranslate` for every keycode and modifier combination on the Hungarian layout, then committed. Drives the hints and the default pool.

### Hint (`src/components/KeyboardHint.vue`)
Inline SVG of a MacBook ISO keyboard. Highlights the physical key plus Shift/Option. After a miss, the hint stays visible until the correct key is pressed, then the next ask starts.

### Screens
- **Practice:** large target character, countdown bar, round and hit counters, hint on a miss.
- **Settings:** characters in the pool, `gameSize`, `timeoutSec`, `hitsPerChar`, `maxRounds`.
- **Statistics:** per character (lifetime asks and hits, recent miss rate, times mastered), per game (date, characters, rounds, mastered per round).

## Data model (JSON store)

```
settings: { pool: string[], gameSize, timeoutSec, hitsPerChar, maxRounds }
chars:    { [char]: { recent: boolean[<=30], asks, hits, masteredCount } }
games:    [ { date, chars: string[], rounds: [ { asked: string[], mastered: string[] } ] } ]
```

## Error handling

- If the pressed key never produces any pool character across several asks, show a notice: "Is the Hungarian input source active?"
- Settings are validated (timeout > 0, counts >= 1, pool non-empty, each pool entry is a single character present in the layout map).
- A corrupt or missing store file falls back to defaults.

## Out of scope (v1)

External Windows keyboards, dead keys and accents, sound, multiple layouts, Cmd shortcuts, cloud sync.

## Testing

Vitest for the round engine. The rest is verified manually via `bun run tauri dev` on the target machine.
