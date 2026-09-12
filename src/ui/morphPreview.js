import { createRustEngine } from "../engine/wasm.js";
import { createRustRenderer } from "../engine/renderer.js";
import { loadGamePackage } from "../game/loadGamePackage.js";

const MAX_MORPH_PACK_BYTES = 64 * 1024 * 1024;

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
  const gameDefinition = await loadGamePackage();
  const renderer = await createRustRenderer({ canvas });
  try {
    for (const bytes of await loadMorphPacks(gameDefinition.morphPacks)) {
      if (!renderer.registerMorphPack(bytes)) {
        throw new Error("The morph pack was rejected by the renderer.");
      }
    }

    const engine = createRustEngine(
      renderer.wasmExports,
      renderer.bindings,
      gameDefinition.manifestSource,
      gameDefinition.script,
    );
    renderer.setAvatarPreviewMode(true);
    engine.setAuthenticated(true);

    let disposed = false;
    let animationFrame = 0;
    let previousTime = performance.now();
    let action = null;
    let actionUntil = 0;
    let previewAppearanceRevision = 0;

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
      previewAppearanceRevision = Math.max(
        previewAppearanceRevision,
        Number(appearance.revision) || 0,
      ) + 1;
      engine.setLocalAppearance(JSON.stringify({
        ...appearance,
        revision: previewAppearanceRevision,
      }));
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
