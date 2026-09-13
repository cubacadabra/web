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

if [ ! -f "$tools_dir/pyproject.toml" ] || [ ! -d "$tools_dir/src/cubacadabra" ]; then
  echo "The shared Cubacadabra tools checkout is missing: $tools_dir" >&2
  exit 1
fi

for game_id in first-game second-game third-game; do
  game_dir="$web_dir/../$game_id"
  public_dir="$web_dir/public/games/$game_id"

  if [ ! -f "$game_dir/manifest.json" ] || [ ! -f "$game_dir/src/main.luau" ]; then
    echo "The $game_id game project is missing manifest.json or src/main.luau: $game_dir" >&2
    exit 1
  fi

  prepare_generated_output "$public_dir"
  PYTHONPATH="$tools_dir/src${PYTHONPATH:+:$PYTHONPATH}" \
    python3 -m cubacadabra build-game "$game_dir" --output "$public_dir"
done

# The newer example projects live together under examples/ while they are
# being developed. Keep Survival 101 locally playable without requiring an
# upload to the cube catalog first.
game_id=survival-101
game_dir="$web_dir/../examples/$game_id"
public_dir="$web_dir/public/games/$game_id"
if [ -f "$game_dir/manifest.json" ] && [ -f "$game_dir/src/main.luau" ]; then
  prepare_generated_output "$public_dir"
  PYTHONPATH="$tools_dir/src${PYTHONPATH:+:$PYTHONPATH}" \
    python3 -m cubacadabra build-game "$game_dir" --output "$public_dir"
fi

game_id=adventure-101
game_dir="$web_dir/../examples/$game_id"
public_dir="$web_dir/public/games/$game_id"
if [ -f "$game_dir/manifest.json" ] && [ -f "$game_dir/src/main.luau" ]; then
  prepare_generated_output "$public_dir"
  PYTHONPATH="$tools_dir/src${PYTHONPATH:+:$PYTHONPATH}" \
    python3 -m cubacadabra build-game "$game_dir" --output "$public_dir"
fi
