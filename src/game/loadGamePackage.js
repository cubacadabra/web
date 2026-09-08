import { backendApiUrl } from "../config/clientConfig.js";

const DEFAULT_GAME_ID = "first-game";
const GAME_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LOCAL_GAME_IDS = new Set([
  "first-game",
  "second-game",
  "third-game",
  "survival-101",
]);
const CUBE_CATALOG_PAGE_SIZE = 50;
const MAX_CUBE_CATALOG_PAGES = 200;
const AUDIO_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const AUDIO_PATH_PATTERN = /^assets\/(?:[A-Za-z0-9_-][A-Za-z0-9._-]*\/)*[A-Za-z0-9_-][A-Za-z0-9._-]*\.wav$/i;
const IMAGE_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const IMAGE_PATH_PATTERN = /^assets\/(?:[A-Za-z0-9_-][A-Za-z0-9._-]*\/)*[A-Za-z0-9_-][A-Za-z0-9._-]*\.(?:jpg|jpeg|png)$/i;

function requestedGameId() {
  const gameId = new URLSearchParams(window.location.search).get("game");
  return gameId && GAME_ID_PATTERN.test(gameId) ? gameId : DEFAULT_GAME_ID;
}

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

async function loadUploadedCubeBaseUrl(gameId) {
  const backendRoot = new URL(backendApiUrl("/"));
  for (let page = 1; page <= MAX_CUBE_CATALOG_PAGES; page += 1) {
    const catalogUrl = new URL(backendApiUrl("/cubes"));
    catalogUrl.searchParams.set("page", String(page));
    catalogUrl.searchParams.set("page_size", String(CUBE_CATALOG_PAGE_SIZE));
    const response = await fetch(catalogUrl, {
      headers: { Accept: "application/json" },
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(result?.error || `The cube catalog could not be loaded (${response.status}).`);
    }

    const cube = Array.isArray(result?.cubes)
      ? result.cubes.find((entry) => entry?.cubeId === gameId)
      : null;
    if (cube) {
      if (typeof cube.packagePath !== "string" || !cube.packagePath.startsWith("/cubes/")) {
        throw new Error("The uploaded cube package path is invalid.");
      }
      const packageUrl = new URL(cube.packagePath, backendRoot);
      if (packageUrl.origin !== backendRoot.origin || !packageUrl.pathname.startsWith("/cubes/")) {
        throw new Error("The uploaded cube package origin is invalid.");
      }
      return packageUrl;
    }
    if (result?.hasNextPage !== true) break;
  }

  throw new Error(`The uploaded cube "${gameId}" could not be found.`);
}

function normalizeAudioAssets(assets, baseUrl) {
  const audio = assets?.audio;
  if (audio === undefined) return {};
  if (!audio || typeof audio !== "object" || Array.isArray(audio)) {
    throw new Error("Game manifest assets.audio must be an object.");
  }

  return Object.fromEntries(Object.entries(audio).map(([id, definition]) => {
    if (!AUDIO_ID_PATTERN.test(id)) {
      throw new Error(`Game audio id "${id}" is invalid.`);
    }
    if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
      throw new Error(`Game audio asset "${id}" must be an object.`);
    }
    const path = definition.path;
    if (typeof path !== "string" || !AUDIO_PATH_PATTERN.test(path)) {
      throw new Error(`Game audio asset "${id}" must reference a WAV inside assets/.`);
    }
    const volume = definition.volume ?? 1;
    if (!Number.isFinite(volume) || volume < 0 || volume > 1) {
      throw new Error(`Game audio asset "${id}" volume must be between 0 and 1.`);
    }
    return [id, {
      url: new URL(path, baseUrl).href,
      volume,
    }];
  }));
}

function normalizeImageAssets(assets, baseUrl) {
  const images = assets?.images;
  if (images === undefined) return {};
  if (!images || typeof images !== "object" || Array.isArray(images)) {
    throw new Error("Game manifest assets.images must be an object.");
  }
  const entries = Object.entries(images);
  if (entries.length > 16) {
    throw new Error("A game package may declare at most 16 world images.");
  }

  return Object.fromEntries(entries.map(([id, definition]) => {
    if (!IMAGE_ID_PATTERN.test(id)) {
      throw new Error(`Game image id "${id}" is invalid.`);
    }
    if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
      throw new Error(`Game image asset "${id}" must be an object.`);
    }
    const path = definition.path;
    if (typeof path !== "string" || !IMAGE_PATH_PATTERN.test(path)) {
      throw new Error(`Game image asset "${id}" must reference a JPG, JPEG, or PNG inside assets/.`);
    }
    return [id, { url: new URL(path, baseUrl).href }];
  }));
}

export async function loadGamePackage() {
  const gameId = requestedGameId();
  const baseUrl = LOCAL_GAME_IDS.has(gameId)
    ? new URL(`games/${gameId}/`, document.baseURI)
    : await loadUploadedCubeBaseUrl(gameId);
  const { source: manifestSource, manifest } = await loadManifest(
    new URL("manifest.json", baseUrl),
  );
  if (manifest?.id !== gameId) {
    throw new Error("The game package ID does not match the requested cube.");
  }
  const script = await loadText(new URL("game.luau", baseUrl));
  if (!script.trim()) {
    throw new Error("The game script is empty.");
  }

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
  const lobbyEnabled = manifest.lobby !== false;
  const startWorld = manifest.startWorld ?? "lobby";
  const activeWorldId = lobbyEnabled || startWorld !== "lobby"
    ? startWorld
    : manifest.launch?.destinationWorld;
  if (!activeWorldId) {
    throw new Error("A game without a lobby must define a launch destination world.");
  }
  const initialWorld = worlds[activeWorldId];
  if (!initialWorld) {
    throw new Error(`The game start world "${activeWorldId}" was not found.`);
  }

  return {
    ...manifest,
    gameId,
    lobbyEnabled,
    manifestSource,
    script,
    worlds,
    runtimeWorldIds: Object.keys(worlds),
    activeWorldId,
    audioAssets: normalizeAudioAssets(manifest.assets, baseUrl),
    imageAssets: normalizeImageAssets(manifest.assets, baseUrl),
  };
}
