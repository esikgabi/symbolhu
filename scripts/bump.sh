#!/bin/sh
# usage: scripts/bump.sh 0.3.0   (macOS sed)
set -e
v=$1; [ -n "$v" ] || { echo "usage: $0 X.Y.Z"; exit 1; }
cd "$(dirname "$0")/.."
sed -i '' "s/^  \"version\": \".*\"/  \"version\": \"$v\"/" package.json src-tauri/tauri.conf.json
sed -i '' "3s/.*/version = \"$v\"/" src-tauri/Cargo.toml
sed -i '' "/^name = \"symbolhu\"/{n;s/.*/version = \"$v\"/;}" src-tauri/Cargo.lock
