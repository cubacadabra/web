import { addWebSettingsRoom } from "../config/settingsRoom.js";

const GAME_PACKAGE_PATH = "games/first-game";

function parseColor(value, fallback = 0xffffff) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return fallback;

  const normalized = value.trim().replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return fallback;
  return Number.parseInt(normalized, 16);
}

async function loadManifest(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`The game manifest could not be loaded (${response.status}).`);
  }
  const source = await response.text();
  return { source, manifest: JSON.parse(source) };
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
  const { manifest: loadedManifest } = await loadManifest(
    new URL("manifest.json", baseUrl),
  );
  const manifest = addWebSettingsRoom(loadedManifest);
  const manifestSource = JSON.stringify(manifest);
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

  const nestedWorlds = Object.entries(manifest.worlds ?? {}).sort(([left], [right]) => (
    left.localeCompare(right)
  ));
  const worlds = Object.fromEntries([
    ["lobby", normalizeWorld(manifest)],
    ...nestedWorlds.map(([id, world]) => [
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
    manifestSource,
    script,
    worlds,
    runtimeWorldIds: Object.keys(worlds),
    activeWorldId: startWorld,
  };
}
