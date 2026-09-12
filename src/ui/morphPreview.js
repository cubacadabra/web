import { createRustEngine } from "../engine/wasm.js";
import { createRustRenderer } from "../engine/renderer.js";
import { backendApiUrl } from "../config/clientConfig.js";

const MAX_MORPH_PACK_BYTES = 64 * 1024 * 1024;
const STANDALONE_PREVIEW_MANIFEST = JSON.stringify({
  id: "web-morph-preview",
  version: "0.0.0",
  sdkVersion: "0.3.0",
  package: { formatVersion: 3, entry: "game.luau" },
  displayName: "Morph Preview",
  lobby: false,
  startWorld: "lobby",
  launch: { destinationWorld: "lobby", authoritative: false },
  world: {
    groundSize: 12,
    gridSize: 0,
    gridDivisions: 0,
    spawn: [0, 0, 0],
    showSpawnPad: false,
  },
});
const STANDALONE_PREVIEW_SCRIPT = "return {}";

async function loadMorphCatalog() {
  const response = await fetch(backendApiUrl("/morphs/catalog?limit=100"), {
    headers: { Accept: "application/json" },
  });
  const catalog = await response.json().catch(() => null);
  if (!response.ok || !Array.isArray(catalog?.assets)) {
    throw new Error(catalog?.error || "The morph catalog could not be loaded.");
  }
  return catalog.assets;
}

async function loadMorphPacks(morphPacks) {
  const loaded = [];
  for (const [id, definition] of Object.entries(morphPacks)) {
    const response = await fetch(definition.url);
    if (!response.ok) {
      throw new Error(`The morph pack "${id}" could not be loaded (${response.status}).`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_MORPH_PACK_BYTES) {
      throw new Error(`The morph pack "${id}" exceeds the supported size limit.`);
    }
    loaded.push(bytes);
  }
  return loaded;
}

export async function createMorphPreview({ canvas }) {
  const catalog = await loadMorphCatalog();
  const renderer = await createRustRenderer({ canvas });
  try {
    const engine = createRustEngine(
      renderer.wasmExports,
      renderer.bindings,
      STANDALONE_PREVIEW_MANIFEST,
      STANDALONE_PREVIEW_SCRIPT,
    );
    renderer.setAvatarPreviewMode(true);
    engine.setAuthenticated(true);

    let disposed = false;
    let animationFrame = 0;
    let previousTime = performance.now();
    let action = null;
    let actionUntil = 0;
    let previewAppearanceRevision = 0;
    const registeredAssets = new Set();
    let appearanceQueue = Promise.resolve();

    async function ensureMorphPacks(appearance) {
      const ids = [appearance.base, ...(appearance.parts || [])];
      if (appearance.face) ids.push(appearance.face);
      const assets = ids.map((id) => catalog.find((asset) => asset.id === id));
      for (const asset of assets) {
        if (!asset || registeredAssets.has(asset.id)) continue;
        const artifactURL = asset.artifact?.url;
        if (!artifactURL) throw new Error(`The morph asset "${asset.id}" has no runtime pack.`);
        const bytes = await loadMorphPacks({ [asset.id]: {
          url: new URL(artifactURL, backendApiUrl("/")).href,
        } });
        if (!renderer.registerMorphPack(bytes[0])) {
          throw new Error(`The morph pack "${asset.id}" was rejected by the renderer.`);
        }
        registeredAssets.add(asset.id);
      }
    }

    function render(currentTime) {
      if (disposed) return;
      const delta = Math.min((currentTime - previousTime) / 1000, 0.05);
      previousTime = currentTime;
      const activeAction = currentTime < actionUntil ? action : null;
      engine.setInput(
        activeAction === "walk" ? 1 : 0,
        0,
        false,
        activeAction === "jump",
        false,
        activeAction === "turn" ? 6 : 0,
        0,
        0,
      );
      engine.step(delta);
      renderer.render(engine.rendererHandle());
      animationFrame = requestAnimationFrame(render);
    }

    function setAppearance(appearance) {
      if (disposed || !appearance?.base) return;
      appearanceQueue = appearanceQueue.then(async () => {
        await ensureMorphPacks(appearance);
        if (disposed) return;
        previewAppearanceRevision = Math.max(
          previewAppearanceRevision,
          Number(appearance.revision) || 0,
        ) + 1;
        engine.setLocalAppearance(JSON.stringify({
          ...appearance,
          revision: previewAppearanceRevision,
        }));
      });
      appearanceQueue.catch(() => {});
    }

    function play(nextAction) {
      if (disposed) return;
      action = nextAction;
      actionUntil = performance.now() + 750;
    }

    animationFrame = requestAnimationFrame(render);
    return {
      setAppearance,
      play,
      destroy() {
        if (disposed) return;
        disposed = true;
        cancelAnimationFrame(animationFrame);
        renderer.destroy();
        engine.destroy();
      },
    };
  } catch (error) {
    renderer.destroy();
    throw error;
  }
}
