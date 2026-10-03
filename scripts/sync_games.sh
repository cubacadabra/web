#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
web_dir=$(dirname "$script_dir")
tools_dir="$web_dir/../tools"

prepare_generated_output() {
  output="$1"
  # These are generated public assets. Remove only an unmarked legacy output
  # so the builder's ownership guard still protects arbitrary user folders.
  if [ -d "$output" ] && [ ! -f "$output/.cubacadabra-build" ]; then
    rm -rf "$output"
  fi
}

if [ ! -f "$tools_dir/scripts/cubacadabra.sh" ]; then
  echo "The shared Cubacadabra tools checkout is missing: $tools_dir" >&2
  exit 1
fi

sync_game() {
  game_dir="$1"
  if [ ! -f "$game_dir/manifest.json" ] || [ ! -f "$game_dir/src/main.luau" ]; then
    echo "The game project is missing manifest.json or src/main.luau: $game_dir" >&2
    exit 1
  fi

  game_id=$(node -e 'const fs = require("node:fs"); const id = JSON.parse(fs.readFileSync(process.argv[1], "utf8")).id; if (typeof id !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(id)) throw new Error("Invalid game id"); process.stdout.write(id);' "$game_dir/manifest.json")
  public_dir="$web_dir/public/games/$game_id"

  prepare_generated_output "$public_dir"
  sh "$tools_dir/scripts/cubacadabra.sh" build-game "$game_dir" --output "$public_dir"
}

if [ "${1:-}" = "--featured" ]; then
  if [ "$#" -ne 1 ]; then
    echo "--featured does not accept additional project paths" >&2
    exit 1
  fi
  node "$script_dir/featured-games.js" | while IFS= read -r game_dir; do
    sync_game "$game_dir"
  done
elif [ "$#" -gt 0 ]; then
  for game_dir in "$@"; do
    sync_game "$game_dir"
  done
else
  examples_dir="$web_dir/../examples"
  if [ ! -f "$examples_dir/cuboom/manifest.json" ]; then
    echo "The examples checkout is missing: $examples_dir" >&2
    exit 1
  fi
  for manifest in "$examples_dir"/*/manifest.json; do
    sync_game "$(dirname "$manifest")"
  done
fi
