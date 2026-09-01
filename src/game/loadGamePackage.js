const GAME_PACKAGE_PATH = "games/first-game";

function parseColor(value, fallback = 0xffffff) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return fallback;

  const normalized = value.trim().replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return fallback;
  return Number.parseInt(normalized, 16);
}

async function loadJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`The game manifest could not be loaded (${response.status}).`);
  }
  return response.json();
}

async function loadText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`The game script could not be loaded (${response.status}).`);
  }
  return response.text();
}

export async function loadGamePackage() {
  const baseUrl = new URL(`${GAME_PACKAGE_PATH}/`, document.baseURI);
  const manifest = await loadJson(new URL("manifest.json", baseUrl));
  const script = await loadText(new URL("game.luau", baseUrl));

  function normalizeWorld(world = {}) {
    const palette = Object.fromEntries(
      Object.entries(world.palette ?? {}).map(([name, value]) => [
        name,
        parseColor(value),
      ]),
    );

    return {
      ...world,
      palette,
      launchPads: (world.launchPads ?? []).map((pad) => ({
        ...pad,
        color: parseColor(pad.color, palette.accent ?? 0xffffff),
      })),
      blocks: (world.blocks ?? []).map((block) => ({
        ...block,
        color: palette[block.color] ?? parseColor(block.color),
      })),
    };
  }

  const worlds = Object.fromEntries([
    ["lobby", normalizeWorld(manifest)],
    ...Object.entries(manifest.worlds ?? {}).map(([id, world]) => [
      id,
      normalizeWorld(world),
    ]),
  ]);
  const startWorld = manifest.startWorld ?? "lobby";
  const initialWorld = worlds[startWorld];
  if (!initialWorld) {
    throw new Error(`The game start world "${startWorld}" was not found.`);
  }

  return {
    ...manifest,
    script,
    worlds,
    activeWorldId: startWorld,
    ...initialWorld,
  };
}
