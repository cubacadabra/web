#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
web_dir=$(dirname "$script_dir")
tools_dir="$web_dir/../tools"

if [ ! -f "$tools_dir/pyproject.toml" ] || [ ! -d "$tools_dir/src/cubacadabra" ]; then
  echo "The shared Cubacadabra tools checkout is missing: $tools_dir" >&2
  exit 1
fi

for game_id in first-game second-game; do
  game_dir="$web_dir/../$game_id"
  public_dir="$web_dir/public/games/$game_id"

  if [ ! -f "$game_dir/manifest.json" ] || [ ! -f "$game_dir/src/main.luau" ]; then
    echo "The $game_id game project is missing manifest.json or src/main.luau: $game_dir" >&2
    exit 1
  fi

  PYTHONPATH="$tools_dir/src${PYTHONPATH:+:$PYTHONPATH}" \
    python3 -m cubacadabra build-game "$game_dir" --output "$public_dir"
done
