#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
web_dir=$(dirname "$script_dir")
game_dir="$web_dir/../first-game"
public_dir="$web_dir/public/games/first-game"

if [ ! -x "$game_dir/scripts/build_game.sh" ]; then
  echo "The first-game package builder is missing: $game_dir/scripts/build_game.sh" >&2
  exit 1
fi

exec "$game_dir/scripts/build_game.sh" --output "$public_dir"
