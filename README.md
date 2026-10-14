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
