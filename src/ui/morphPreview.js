import { createRustEngine } from "../engine/wasm.js";
import { createRustRenderer } from "../engine/renderer.js";
import { backendApiUrl } from "../config/clientConfig.js";

const MAX_MORPH_PACK_BYTES = 64 * 1024 * 1024;
const PREVIEW_ACTION_DURATION_MS = 1500;
const PREVIEW_JOYSTICK_RADIUS = 96;
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
    let movementForward = 0;
    let movementStrafe = 0;
    let lookX = 0;
    let lookY = 0;
    let zoomDelta = 0;
    let initialZoomPending = true;
    let pointer = null;
    const registeredAssets = new Set();
    let appearanceQueue = Promise.resolve();
    const removeListeners = [];

    function listen(target, type, handler, options) {
      target.addEventListener(type, handler, options);
      removeListeners.push(() => target.removeEventListener(type, handler, options));
    }

    function resetPointer(pointerId) {
      if (!pointer || (pointerId !== undefined && pointer.id !== pointerId)) return;
      pointer = null;
      movementForward = 0;
      movementStrafe = 0;
      canvas.classList.remove("is-moving", "is-looking");
    }

    function handlePointerDown(event) {
      if (pointer || (event.pointerType === "mouse" && event.button !== 0 && event.button !== 2)) {
        return;
      }
      const bounds = canvas.getBoundingClientRect();
      const localX = event.clientX - bounds.left;
      const mode = event.button === 2 || localX >= bounds.width / 2 ? "look" : "move";
      event.preventDefault();
      canvas.setPointerCapture(event.pointerId);
      canvas.focus({ preventScroll: true });
      pointer = {
        id: event.pointerId,
        mode,
        originX: event.clientX,
        originY: event.clientY,
        x: event.clientX,
        y: event.clientY,
      };
      canvas.classList.add(mode === "look" ? "is-looking" : "is-moving");
    }

    function handlePointerMove(event) {
      if (!pointer || event.pointerId !== pointer.id) return;
      event.preventDefault();
      if (pointer.mode === "move") {
        movementStrafe = Math.max(-1, Math.min(1,
          (event.clientX - pointer.originX) / PREVIEW_JOYSTICK_RADIUS,
        ));
        movementForward = Math.max(-1, Math.min(1,
          -(event.clientY - pointer.originY) / PREVIEW_JOYSTICK_RADIUS,
        ));
      } else {
        lookX += event.clientX - pointer.x;
        lookY += event.clientY - pointer.y;
      }
      pointer.x = event.clientX;
      pointer.y = event.clientY;
    }

    function handleWheel(event) {
      if (Math.abs(event.deltaY) < 0.5) return;
      event.preventDefault();
      zoomDelta += Math.sign(event.deltaY) * 0.9;
    }

    listen(canvas, "pointerdown", handlePointerDown);
    listen(canvas, "pointermove", handlePointerMove);
    listen(canvas, "pointerup", (event) => resetPointer(event.pointerId));
    listen(canvas, "pointercancel", (event) => resetPointer(event.pointerId));
    listen(canvas, "lostpointercapture", (event) => resetPointer(event.pointerId));
    listen(canvas, "contextmenu", (event) => event.preventDefault());
    listen(canvas, "wheel", handleWheel, { passive: false });

    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(() => renderer.resize());
    if (resizeObserver) {
      resizeObserver.observe(canvas);
    } else {
      listen(window, "resize", renderer.resize);
    }

    async function ensureMorphPacks(appearance) {
      const ids = [appearance.base, ...(appearance.parts || [])];
      if (appearance.face) ids.push(appearance.face);
      const assets = ids.map((id) => catalog.find((asset) => asset.id === id));
      for (const asset of assets) {
        if (!asset || registeredAssets.has(asset.id)) continue;
        const artifactURL = asset.artifact?.url;
        // Faces are analytic renderer inputs. They are part of the v2
        // loadout, but do not have a .morphpack artifact to register.
        if (!artifactURL) continue;
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
      let forward = movementForward + (activeAction === "walk" ? 1 : 0);
      let strafe = movementStrafe;
      const movementLength = Math.hypot(forward, strafe);
      if (movementLength > 1) {
        forward /= movementLength;
        strafe /= movementLength;
      }
      engine.setInput(
        forward,
        strafe,
        false,
        activeAction === "jump",
        false,
        lookX + (activeAction === "turn" ? 6 : 0),
        lookY,
        zoomDelta + (initialZoomPending ? -6.5 : 0),
      );
      initialZoomPending = false;
      lookX = 0;
      lookY = 0;
      zoomDelta = 0;
      engine.step(delta);
      renderer.render(engine.rendererHandle());
      animationFrame = requestAnimationFrame(render);
    }

    function setAppearance(appearance, renderAppearance = appearance) {
      if (disposed || !appearance?.base) return;
      appearanceQueue = appearanceQueue.catch((error) => {
        console.error("Previous morph preview update failed", error);
      }).then(async () => {
        await ensureMorphPacks(appearance);
        if (disposed) return;
        previewAppearanceRevision = Math.max(
          previewAppearanceRevision,
          Number(appearance.revision) || 0,
        ) + 1;
        const status = engine.setLocalAppearance(JSON.stringify({
          ...renderAppearance,
          revision: previewAppearanceRevision,
        }));
        if (!status) throw new Error("The morph preview rejected the selected appearance.");
      });
    }

    function play(nextAction) {
      if (disposed) return;
      action = nextAction;
      actionUntil = performance.now() + PREVIEW_ACTION_DURATION_MS;
    }

    animationFrame = requestAnimationFrame(render);
    return {
      setAppearance,
      play,
      destroy() {
        if (disposed) return;
        disposed = true;
        cancelAnimationFrame(animationFrame);
        resetPointer();
        resizeObserver?.disconnect();
        removeListeners.forEach((remove) => remove());
        renderer.destroy();
        engine.destroy();
      },
    };
  } catch (error) {
    renderer.destroy();
    throw error;
  }
}
