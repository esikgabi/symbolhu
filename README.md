# symbolhu

A small desktop trainer built with **Tauri 2** and **Vue 3** for the symbols that are hard to find on a Hungarian Mac keyboard: `< > * ( )` and more. It drills you on the characters you miss most, and shows exactly which keys to press when you get one wrong.

![Practice screen with keyboard hint](screenshots/hint.png)

## Installation

There are no prebuilt releases yet. Build the app from source (see [Building](#building)); it targets macOS on Apple Silicon.

## Features

-   **Weakness-driven games**: each game picks the 5 characters you miss most (miss rate over your last 30 asks); with no history it starts with `< > * ( )`.
-   **Rounds**: every active character is asked 3 times per round, shuffled, never the same one twice in a row. A character with all hits in a round is mastered and dropped; the game ends when none remain or after 10 rounds.
-   **Instant hints**: a wrong key or a 3 s timeout is a miss and shows the key combo on an on-screen keyboard. The hint stays until you press the right key (`Esc` skips it).
-   **Statistics**: per-character asks, hits, recent miss rate and times mastered, plus a game history.
-   **Configurable**: character pool, characters per game, timeout, hits per character and max rounds (all clamped to sane limits).
-   **Wrong input source detection**: warns when the Y/Z swap shows the Hungarian layout is not active.
-   **Local only**: data is saved on your machine via `tauri-plugin-store` (falls back to `localStorage` in the browser). No network, no telemetry.

## Gallery

### Menu
![Menu](screenshots/menu.png)

### Asking a symbol
![Practice](screenshots/practice.png)

### Settings
![Settings](screenshots/settings.png)

## Settings

The **Settings** screen controls what you practise and how strict each game is:

-   **Characters to practise (pool)**: every symbol that may show up in a game, typed as plain characters (spaces are ignored). Only characters that exist on the Hungarian layout are accepted; anything else is dropped on save. *Reset pool to all layout symbols* fills it with every symbol the layout map knows.
-   **Characters per game** (1-50, default 5): how many characters from the pool are drilled in one game. They are the weakest ones, ranked by miss rate over your last 30 asks.
-   **Timeout** (up to 60 s, default 3): how long you get to answer before it counts as a miss and the hint appears.
-   **Hits per character per round** (1-20, default 3): how many correct answers a character needs in a round to count as mastered.
-   **Max rounds** (1-100, default 10): the game ends after this many rounds even if some characters are not mastered yet.

Invalid or out-of-range values silently fall back to the defaults. Settings and statistics are stored locally and persist between runs.

## Tech Stack

-   **Core**: [Tauri 2](https://v2.tauri.app/) (Rust)
-   **Frontend**: [Vue 3](https://vuejs.org/) (Composition API, `<script setup>`) + [Vite](https://vitejs.dev/) + TypeScript
-   **Persistence**: [tauri-plugin-store](https://v2.tauri.app/plugin/store/)
-   **Tests**: [Vitest](https://vitest.dev/)
-   **Package manager**: [Bun](https://bun.sh/)

## Development

### Prerequisites

-   [Bun](https://bun.sh/): package manager and script runner (`curl -fsSL https://bun.sh/install | bash`).
-   [Rust](https://www.rust-lang.org/tools/install): stable toolchain via `rustup`, needed by Tauri.
-   Xcode Command Line Tools (`xcode-select --install`): C toolchain for Tauri on macOS. See the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for details.
-   The **Hungarian** input source enabled in macOS (System Settings → Keyboard → Input Sources), so the key hints match what you type.
-   *Optional*: `swiftc` (ships with the Xcode Command Line Tools), only to regenerate the layout map.

### Setup

```bash
git clone https://github.com/esikgabi/symbolhu.git
cd symbolhu
bun install
```

### Commands

```bash
bun run dev            # browser only, localStorage
bun run tauri dev      # native window
bun run test           # unit tests
bun run build          # type-check + production frontend build
```

### Building

```bash
bun run tauri build    # release .app and .dmg (Apple Silicon)
```

Output lands in `src-tauri/target/release/bundle/`.

> **Note:** `cargo check` needs the frontend output dir to exist: run `mkdir -p dist` first (`dist` is gitignored).

### Regenerating the layout map

Needs the Hungarian input source enabled. Don't hand-edit the JSON; rerun the script:

```bash
swiftc -O scripts/gen-layout.swift -o /tmp/gen-layout && /tmp/gen-layout > src/data/layout-hu-mac.json
```

## Project Structure

-   `src/`: Vue frontend.
    -   `engine/`: pure game logic (queue building, weakness, `GameSession`, settings), unit-tested, no Vue/Tauri imports.
    -   `input/`: classifies a `KeyboardEvent` as hit, miss or ignored.
    -   `components/`: `Practice`, `Settings`, `Stats`, `KeyboardHint`.
    -   `data/layout-hu-mac.json`: character to physical key and modifiers (generated).
    -   `layout.ts`, `store.ts`: layout lookup and persistence.
-   `src-tauri/`: Rust shell, capabilities and Tauri config.
-   `scripts/`: layout generator (`gen-layout.swift`).
-   `docs/superpowers/`: design spec and implementation plan.
-   `screenshots/`: images used in this README.

## License

This project is licensed under the GNU General Public License v3 - see the [LICENSE](LICENSE) file for details.
