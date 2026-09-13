import { backendApiUrl } from "../config/clientConfig.js";

const DEFAULT_GAME_ID = "first-game";
const GAME_ID_PATTERN = /^(?=.{3,64}$)[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LOCAL_GAME_IDS = new Set([
  "first-game",
  "second-game",
  "third-game",
  "survival-101",
  "adventure-101",
]);
const AUDIO_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const AUDIO_PATH_PATTERN = /^assets\/(?:[A-Za-z0-9_-][A-Za-z0-9._-]*\/)*[A-Za-z0-9_-][A-Za-z0-9._-]*\.wav$/i;
const IMAGE_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const IMAGE_PATH_PATTERN = /^assets\/(?:[A-Za-z0-9_-][A-Za-z0-9._-]*\/)*[A-Za-z0-9_-][A-Za-z0-9._-]*\.(?:jpg|jpeg|png)$/i;
const MORPH_ID_PATTERN = /^[a-z0-9-]+:[a-z0-9_-]+(?:\/[a-z0-9_-]+)*\.v[1-9][0-9]*$/;
const MORPH_PATH_PATTERN = /^assets\/(?:[A-Za-z0-9_-][A-Za-z0-9._-]*\/)*[A-Za-z0-9_-][A-Za-z0-9._-]*\.morphpack$/i;

function requestedGameId() {
  const params = new URLSearchParams(window.location.search);
  const gameId = params.get("game");
  if (gameId === null) return DEFAULT_GAME_ID;
  if (gameId.trim() === gameId && GAME_ID_PATTERN.test(gameId)) return gameId;
  throw new Error("The requested game ID is invalid.");
}

function parseColor(value, fallback = 0xffffff) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return fallback;

  const normalized = value.trim().replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return fallback;
  return Number.parseInt(normalized, 16);
}

async function loadBytes(url, description) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`The ${description} could not be loaded (${response.status}).`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

async function loadManifest(url) {
  const bytes = await loadBytes(url, "game manifest");
  const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  return { source, manifest: JSON.parse(source) };
}

async function loadText(url) {
  return new TextDecoder("utf-8", { fatal: true }).decode(
    await loadBytes(url, "game script"),
  );
}

async function loadPackageDescriptor(url) {
  const bytes = await loadBytes(url, "game package descriptor");
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

async function sha256(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function validatePackageDescriptor(descriptor, gameId, manifest, manifestSource, script) {
  if (
    !descriptor
    || descriptor.id !== gameId
    || descriptor.entry !== "game.luau"
    || descriptor.manifest !== "manifest.json"
    || String(descriptor.version) !== String(manifest.version)
    || !descriptor.sha256
    || typeof descriptor.sha256 !== "object"
  ) throw new Error("The game package descriptor is invalid.");

  const manifestHash = await sha256(new TextEncoder().encode(manifestSource));
  const scriptHash = await sha256(new TextEncoder().encode(script));
  if (
    descriptor.sha256["manifest.json"] !== manifestHash
    || descriptor.sha256["game.luau"] !== scriptHash
  ) throw new Error("The game package files do not match their release descriptor.");
}

async function loadUploadedCubeBaseUrl(gameId) {
  const backendRoot = new URL(backendApiUrl("/"));
  const detailUrl = new URL(backendApiUrl(`/cubes/${encodeURIComponent(gameId)}`));
  const response = await fetch(detailUrl, {
    headers: { Accept: "application/json" },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(result?.error || `The uploaded cube could not be loaded (${response.status}).`);
  }

  const cube = result?.cube;
  if (cube?.id !== gameId) {
    throw new Error("The uploaded cube ID does not match the requested game.");
  }
  if (typeof cube.packagePath !== "string" || !cube.packagePath.startsWith("/cubes/")) {
    throw new Error("The uploaded cube package path is invalid.");
  }
  const packageUrl = new URL(cube.packagePath, backendRoot);
  if (packageUrl.origin !== backendRoot.origin || !packageUrl.pathname.startsWith("/cubes/")) {
    throw new Error("The uploaded cube package origin is invalid.");
  }
  return packageUrl;
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

function normalizeMorphPacks(assets, baseUrl) {
  const morphPacks = assets?.morphPacks;
  if (morphPacks === undefined) return {};
  if (!morphPacks || typeof morphPacks !== "object" || Array.isArray(morphPacks)) {
    throw new Error("Game manifest assets.morphPacks must be an object.");
  }
  const entries = Object.entries(morphPacks);
  if (entries.length > 32) {
    throw new Error("A game package may declare at most 32 morph packs.");
  }

  return Object.fromEntries(entries.map(([id, definition]) => {
    if (!MORPH_ID_PATTERN.test(id)) {
      throw new Error(`Game morph pack id "${id}" is invalid.`);
    }
    if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
      throw new Error(`Game morph pack "${id}" must be an object.`);
    }
    const path = definition.path;
    if (typeof path !== "string" || !MORPH_PATH_PATTERN.test(path)) {
      throw new Error(`Game morph pack "${id}" must reference a .morphpack inside assets/.`);
    }
    return [id, { url: new URL(path, baseUrl).href }];
  }));
}

export async function loadGamePackage() {
  const gameId = requestedGameId();
  const baseUrl = LOCAL_GAME_IDS.has(gameId)
    // Account pages live below routes such as /my-cube/. Resolve bundled game
    // packages from the site base rather than accidentally requesting
    // /my-cube/games/<id>/.
    ? new URL(`games/${gameId}/`, new URL(import.meta.env.BASE_URL, document.baseURI))
    : await loadUploadedCubeBaseUrl(gameId);
  const packageDescriptor = await loadPackageDescriptor(
    new URL("package.json", baseUrl),
  );
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
  await validatePackageDescriptor(packageDescriptor, gameId, manifest, manifestSource, script);

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
    packageDescriptor,
    script,
    worlds,
    runtimeWorldIds: Object.keys(worlds),
    activeWorldId,
    audioAssets: normalizeAudioAssets(manifest.assets, baseUrl),
    imageAssets: normalizeImageAssets(manifest.assets, baseUrl),
    morphPacks: normalizeMorphPacks(manifest.assets, baseUrl),
  };
}
