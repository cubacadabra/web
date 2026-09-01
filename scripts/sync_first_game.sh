#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
web_dir=$(dirname "$script_dir")
game_dir="$web_dir/../first-game"
public_dir="$web_dir/public/games/first-game"

if [ ! -f "$game_dir/manifest.json" ] || [ ! -f "$game_dir/game.luau" ]; then
  echo "The first-game package is missing manifest.json or game.luau." >&2
  exit 1
fi

mkdir -p "$public_dir"
cp "$game_dir/manifest.json" "$public_dir/manifest.json"
cp "$game_dir/game.luau" "$public_dir/game.luau"

if [ -d "$game_dir/assets" ]; then
  mkdir -p "$public_dir/assets"
  cp -R "$game_dir/assets/." "$public_dir/assets/"
fi

