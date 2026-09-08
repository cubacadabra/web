import { createRustEngine } from "../engine/wasm.js";
import { createRustRenderer } from "../engine/renderer.js";
import { loadGamePackage } from "../game/loadGamePackage.js";
import { createWorldSocket } from "../network/worldSocket.js";
import { bindControls } from "../systems/controls.js";
import { getMovementInput } from "../systems/player.js";
import { createGameAudio } from "../systems/audio.js";
import { createGameState } from "../state/gameState.js";
import { createSettingsRoomController } from "../ui/settingsRoom.js";
import { createBuildModeController } from "../ui/buildMode.js";
import { getDomElements } from "../ui/dom.js";
import { createHudController } from "../ui/hud.js";
import { createCharacterShowcaseController } from "../ui/characterShowcase.js";
import { getCurrentUser } from "../auth/session.js";

const DEFAULT_BODY_ID = "cuba:person.v1";
const PLAYER_BODY_IDS = new Set([
  DEFAULT_BODY_ID,
  "cuba:person-girl.v1",
  "cuba:person-nb.v1",
]);
const MOVEMENT_DEBUG = new URLSearchParams(window.location.search).get("debugMovement") === "1";

async function decodePackageImage(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`The game image could not be loaded (${response.status}).`);
  }
  const blob = await response.blob();
  let bitmap;
  let objectUrl;
  try {
    if (typeof createImageBitmap === "function") {
      bitmap = await createImageBitmap(blob);
    } else {
      objectUrl = URL.createObjectURL(blob);
      const image = new Image();
      image.decoding = "async";
      image.src = objectUrl;
      await image.decode();
      bitmap = image;
    }
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("The game image canvas is unavailable.");
    context.drawImage(bitmap, 0, 0);
    const imageData = context.getImageData(0, 0, bitmap.width, bitmap.height);
    return {
      width: bitmap.width,
      height: bitmap.height,
      pixels: new Uint8Array(imageData.data),
    };
  } finally {
    bitmap?.close?.();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

function nextPowerOfTwo(value) {
  let result = 1;
  while (result < value) result *= 2;
  return result;
}

function fitPackageImageForAtlas(image, maxDimension) {
  const sourceDimension = Math.max(image.width, image.height);
  if (sourceDimension <= maxDimension) return image;

  const scale = maxDimension / sourceDimension;
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = image.width;
  sourceCanvas.height = image.height;
  const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
  if (!sourceContext) throw new Error("The game image resize canvas is unavailable.");
  sourceContext.putImageData(
    new ImageData(new Uint8ClampedArray(image.pixels), image.width, image.height),
    0,
    0,
  );

  const targetCanvas = document.createElement("canvas");
  targetCanvas.width = width;
  targetCanvas.height = height;
  const targetContext = targetCanvas.getContext("2d", { willReadFrequently: true });
  if (!targetContext) throw new Error("The game image resize canvas is unavailable.");
  targetContext.drawImage(sourceCanvas, 0, 0, width, height);
  return {
    ...image,
    width,
    height,
    pixels: new Uint8Array(targetContext.getImageData(0, 0, width, height).data),
  };
}

function createPackageImageAtlas(images) {
  const maxDimension = 2048;
  const padding = 2;
  // Two large material images should still fit on a shelf. The source image
  // remains package-owned; this is only the renderer upload resolution.
  const atlasImages = images.map((image) => fitPackageImageForAtlas(image, 1020));
  const placements = [];
  let x = padding;
  let y = padding;
  let rowHeight = 0;

  for (const image of atlasImages) {
    if (image.width + padding * 2 > maxDimension || image.height + padding * 2 > maxDimension) {
      throw new Error(`The game image "${image.id}" is too large for the world texture atlas.`);
    }
    if (x + image.width + padding > maxDimension) {
      x = padding;
      y += rowHeight + padding;
      rowHeight = 0;
    }
    if (y + image.height + padding > maxDimension) {
      throw new Error("The game images do not fit in the 2048px world texture atlas.");
    }
    placements.push({ image, x, y });
    x += image.width + padding;
    rowHeight = Math.max(rowHeight, image.height);
  }

  const width = maxDimension;
  const height = Math.min(maxDimension, nextPowerOfTwo(y + rowHeight + padding));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("The game image atlas canvas is unavailable.");

  const regions = {};
  for (const { image, x: left, y: top } of placements) {
    const imageData = new ImageData(
      new Uint8ClampedArray(image.pixels),
      image.width,
      image.height,
    );
    context.putImageData(imageData, left, top);
    regions[image.id] = [
      (left + 0.5) / width,
      (top + 0.5) / height,
      Math.max(1, image.width - 1) / width,
      Math.max(1, image.height - 1) / height,
    ];
  }
  const atlas = context.getImageData(0, 0, width, height);
  return {
    width,
    height,
    pixels: new Uint8Array(atlas.data),
    regions,
  };
}

function playerBodyId(value) {
  return PLAYER_BODY_IDS.has(value) ? value : null;
}

export async function createGame() {
  const currentUser = await getCurrentUser();
  const elements = getDomElements();
  const gameDefinition = await loadGamePackage();
  const isTouchDevice =
    typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
  elements.worldShell?.classList.toggle("is-touch-device", isTouchDevice);
  const renderer = await createRustRenderer({ canvas: elements.canvas });
  const engine = createRustEngine(renderer.wasmExports);
  const packageImages = await Promise.all(
    Object.entries(gameDefinition.imageAssets).map(async ([id, definition]) => ({
      id,
      ...(await decodePackageImage(definition.url)),
    })),
  );
  if (packageImages.length > 0) {
    const atlas = createPackageImageAtlas(packageImages);
    if (!renderer.setPackageImageAtlas(
      atlas.width,
      atlas.height,
      atlas.pixels,
      JSON.stringify(atlas.regions),
    )) {
      throw new Error("The game images could not be uploaded to the world texture atlas.");
    }
  }
  const gameAudio = createGameAudio(gameDefinition.audioAssets);
  const engineCapabilities = engine.getCharacterShowcaseCapabilities?.() ?? {};
  engine.loadGamePackage(gameDefinition.manifestSource);
  let localAppearance = gameDefinition.avatars?.player?.character ?? null;
  const appearanceStorageKey = currentUser?.id
    ? `cubacadabra.character-appearance:${encodeURIComponent(currentUser.id)}`
    : "cubacadabra.character-appearance";
  try {
    const storedAppearance = window.localStorage.getItem(appearanceStorageKey);
    if (storedAppearance) {
      localAppearance = JSON.parse(storedAppearance);
    }
  } catch {
    // The bundled package appearance remains the safe offline default.
  }
  const selectedBodyId = playerBodyId(currentUser?.body_id);
  if (selectedBodyId) {
    localAppearance = {
      ...(localAppearance || {}),
      version: 1,
      body: selectedBodyId,
      revision: Math.max(Number(localAppearance?.revision) || 0, 0) + 1,
    };
  }
  if (localAppearance) engine.setLocalAppearance(JSON.stringify(localAppearance));
  engine.loadGameScript(gameDefinition.script);
  engine.setAuthenticated(Boolean(currentUser));
  if (currentUser?.username) engine.setUsername(currentUser.username);
  const runtimeWorldIds = gameDefinition.runtimeWorldIds;
  const initialFrame = engine.readFrame();
  const initialWorldId = runtimeWorldIds[initialFrame.activeWorldIndex]
    ?? gameDefinition.activeWorldId;
  const hasLobby = initialWorldId === "lobby" && gameDefinition.lobbyEnabled;
  const state = createGameState();
  state.runtime.worldId = initialWorldId;
  let activeWorld = gameDefinition.worlds[initialWorldId];
  const remotePlayers = new Map();
  let remoteRosterDirty = true;
  let remoteSequence = 0;
  let worldSocket = null;
  let pendingSessionWorldId = null;
  let buildMode = null;
  const hud = createHudController({ elements, state, gameDefinition: activeWorld });
  const characterShowcase = createCharacterShowcaseController({
    elements,
    state,
    engine,
    manifestSource: gameDefinition.manifestSource,
    runtimeWorldIds,
    initialAppearance: localAppearance,
    getAppearanceRevision: () => engine.appearanceRevision(),
    onAppearanceChange: (appearance) => {
      const primary = localAppearance?.colors?.primary;
      const nextAppearance = typeof primary === "string"
        ? {
          ...appearance,
          colors: { ...(appearance.colors || {}), primary },
          revision: Math.max(
            Number(appearance.revision) || 0,
            engine.appearanceRevision(),
          ) + 1,
        }
        : appearance;
      if (nextAppearance !== appearance) {
        engine.setLocalAppearance(JSON.stringify(nextAppearance));
      }
      localAppearance = nextAppearance;
      try {
        window.localStorage.setItem(appearanceStorageKey, JSON.stringify(nextAppearance));
      } catch {
        // The appearance still applies to the current engine session.
      }
      worldSocket?.setAppearance(nextAppearance);
    },
  });
  worldSocket = createWorldSocket({
    gameId: gameDefinition.gameId,
    initialUsername: currentUser?.username,
    onSession: (session) => {
      if (session.username) engine.setUsername(session.username);
      applyServerAppearance(session.appearance);
    },
    onEvent: (event) => {
      hud.showWorldEvent(event);
      if (event.type === "player_leave") {
        remotePlayers.delete(event.id);
        remoteRosterDirty = true;
      }
      if (event.type === "player_join" && !event.isSelf) {
        remotePlayers.set(event.id, {
          id: event.id,
          username: event.username ?? event.id,
          generation: event.generation ?? 0,
          position: [0, 0, 0],
          yaw: 0,
          moving: false,
          sprinting: false,
          appearance: event.appearance ?? null,
        });
        remoteRosterDirty = true;
      }
      if (event.type === "appearance" && remotePlayers.has(event.id)) {
        remotePlayers.get(event.id).appearance = event.appearance ?? null;
        remoteRosterDirty = true;
      }
      if (event.type === "player_name" && remotePlayers.has(event.id)) {
        remotePlayers.get(event.id).username = event.username;
        remoteRosterDirty = true;
      }
    },
    onMove: (event) => {
      if (event.isSelf) {
        if (event.corrected) {
          if (MOVEMENT_DEBUG) {
            const local = engine.readFrame().player.position;
            console.debug("[cubacadabra movement correction]", {
              reason: event.correctionReason ?? "unknown",
              distance: event.correctionDistance ?? null,
              validationElapsedMs: event.validationElapsedMs ?? null,
              local,
              server: { x: event.x, y: event.y, z: event.z },
            });
          }
          engine.reconcilePlayer({ x: event.x, y: event.y, z: event.z }, event.yaw);
        }
        return;
      }
      const previous = remotePlayers.get(event.id);
      if (!previous) remoteRosterDirty = true;
      const player = {
        id: event.id,
        username: previous?.username ?? event.id,
        generation: event.generation ?? previous?.generation ?? 0,
        position: [event.x, event.y, event.z],
        yaw: event.yaw,
        moving: event.moving,
        sprinting: event.sprinting,
        appearance: previous?.appearance ?? null,
      };
      remotePlayers.set(event.id, player);
      // Keep the full versioned roster authoritative for every incoming move.
      // This avoids making one client depend on the optional typed-motion ABI
      // while another client is still sending normal JSON moves.
      remoteRosterDirty = true;
    },
    onExperience: (event) => {
      if (event.type === "experience_state") {
        hud.updateExperience(event);
        buildMode?.handleState(event);
        return;
      }
      if (event.type === "experience_launch") {
        if (!event.playerIds?.includes(worldSocket.playerId)) return;
        pendingSessionWorldId = event.sessionWorldId;
        const sessionIndex = runtimeWorldIds.indexOf("real-game");
        if (sessionIndex >= 0) engine.startWorld(sessionIndex);
      }
    },
    onGameMessage: (event) => {
      engine.receiveNetworkMessage(JSON.stringify(event));
    },
    onStatusChange: hud.setConnectionStatus,
  });
  function applyServerAppearance(serverAppearance) {
    const primary = serverAppearance?.colors?.primary;
    if (typeof primary !== "string") return;

    localAppearance = {
      ...(localAppearance || {}),
      colors: {
        ...(localAppearance?.colors || {}),
        primary,
      },
      revision: Math.max(
        Number(localAppearance?.revision) || 0,
        Number(serverAppearance.revision) || 0,
        engine.appearanceRevision(),
      ) + 1,
    };
    engine.setLocalAppearance(JSON.stringify(localAppearance));
    worldSocket.setAppearance(localAppearance);
  }

  const settingsRoom = createSettingsRoomController({
    elements,
    state,
    worldSocket,
    engine,
  });
  buildMode = createBuildModeController({
    state,
    worldSocket,
    engine,
    onReturn: () => {
      pendingSessionWorldId = null;
      const returnWorldId = hasLobby ? "lobby" : initialWorldId;
      const returnIndex = runtimeWorldIds.indexOf(returnWorldId);
      if (returnIndex >= 0) engine.startWorld(returnIndex);
    },
  });

  function handleUIEvents() {
    let event;
    while ((event = engine.pollUIEvent())) {
      if (event.action === "player.move") {
        state.movement.joystickX = Number.isFinite(event.x) ? event.x : 0;
        state.movement.joystickY = Number.isFinite(event.y) ? event.y : 0;
      } else if (event.action === "player.jump" && event.phase === "activate") {
        state.movement.jumpQueued = true;
      } else if (event.action === "player.run" && event.phase === "activate") {
        state.movement.mobileSprint = !state.movement.mobileSprint;
      } else if (event.action === "player.climb" && event.phase === "activate") {
        state.movement.climb = !state.movement.climb;
      } else if (event.action === "shared.about.open" && event.phase === "activate") {
        // The web pointer-up handler navigates synchronously to preserve
        // browser user activation and avoid popup blockers.
      } else if (event.action === "shared.sign_in" && event.phase === "activate") {
        const baseURL = new URL(import.meta.env.BASE_URL, document.baseURI);
        window.location.assign(new URL("login/", baseURL).href);
      } else if (event.action === "shared.leave_game" && event.phase === "activate") {
        window.location.assign("/my-cube/");
      } else {
        buildMode?.handleUiEvent(event);
      }
      hud.dismissHint();
    }
  }

  function flushNetworkMessages() {
    let source;
    while ((source = engine.pollNetworkMessage?.())) {
      let message;
      try {
        message = JSON.parse(source);
      } catch {
        continue;
      }
      if (!message || typeof message.channel !== "string") continue;
      const compareSet = Number.isSafeInteger(message.expectedSequence)
        && message.expectedSequence >= 0;
      worldSocket.sendGameMessage(
        compareSet
          ? "game_state_compare_set"
          : message.retained ? "game_state_set" : "game_message",
        message.channel,
        message.payload,
        compareSet ? message.expectedSequence : null,
      );
    }
  }

  function flushAudioMessages() {
    let source;
    while ((source = engine.pollAudioMessage?.())) {
      try {
        gameAudio.play(JSON.parse(source));
      } catch {
        // Malformed game-owned commands are ignored without interrupting play.
      }
    }
  }

  let connectedWorldId = null;

  function syncRemotePlayers() {
    if (state.runtime.worldId === "settings") {
      if (!remoteRosterDirty) return;
      remoteRosterDirty = false;
      if (engineCapabilities.persistentIdentity) {
        remoteSequence += 1;
        engine.applyRemoteUpdate(JSON.stringify({
          version: 1,
          sequence: remoteSequence,
          players: [],
        }));
      } else {
        engine.setRemotePlayers([]);
      }
      return;
    }
    const players = [...remotePlayers.values()];
    if (engineCapabilities.persistentIdentity && remoteRosterDirty) {
      remoteSequence += 1;
      remoteRosterDirty = false;
      engine.applyRemoteUpdate(JSON.stringify({
        version: 1,
        sequence: remoteSequence,
        worldId: state.runtime.worldId,
        players: players.map((player) => ({
          id: player.id,
          username: player.username,
          generation: player.generation,
          position: player.position,
          yaw: player.yaw,
          moving: player.moving,
          sprinting: player.sprinting,
          ...(player.appearance ? { appearance: player.appearance } : {}),
        })),
      }));
    }
    if (engineCapabilities.persistentIdentity) return;
    if (!remoteRosterDirty) return;
    remoteRosterDirty = false;
    engine.setRemotePlayers(players.map((player) => ({
      x: player.position[0],
      y: player.position[1],
      z: player.position[2],
      yaw: player.yaw,
      moving: player.moving,
      sprinting: player.sprinting,
    })));
  }

  function connectWorld(worldId) {
    const networkWorldId = worldId === "settings"
      ? "lobby"
      : worldId === "real-game" && pendingSessionWorldId
        ? pendingSessionWorldId
        : worldId;
    if (networkWorldId === connectedWorldId) return;
    connectedWorldId = networkWorldId;
    remotePlayers.clear();
    remoteRosterDirty = true;
    remoteSequence = 0;
    engine.resetRemoteSession?.();
    syncRemotePlayers();
    worldSocket.connect(networkWorldId);
  }

  worldSocket.setHidden(state.runtime.worldId === "settings");
  connectWorld(state.runtime.worldId);

  const controls = bindControls({
    elements,
    state,
    onDismissHint: hud.dismissHint,
    onResetView: () => {
      engine.resetView();
    },
    onLook: (horizontal, vertical) => {
      state.movement.lookX += horizontal;
      state.movement.lookY += vertical;
    },
    onZoom: (amount) => {
      state.movement.zoomDelta += amount;
    },
    onInteract: () => settingsRoom.interact(),
    onUiPointer: (pointerId, phase, x, y) => engine.uiPointer(pointerId, phase, x, y),
    onUiHitTest: (x, y) => engine.uiHitTest(x, y),
    onUiExternalLinkHitTest: (x, y) => engine.uiExternalLinkHitTest(x, y),
    onOpenExternalLink: () => window.location.assign("/about/"),
    onBuildKeyboard: (event) => buildMode?.handleKeyboard(event),
    onShowcaseKeyboard: (event) => characterShowcase.handleKeyboard(event),
  });

  function resizeRenderer() {
    const width = elements.canvas.clientWidth;
    const height = elements.canvas.clientHeight;
    if (!width || !height) return;

    renderer.resize();
    engine.setUIViewport(
      width,
      height,
      Math.min(window.devicePixelRatio || 1, 2),
    );
  }

  const resizeObserver = new ResizeObserver(resizeRenderer);
  resizeObserver.observe(elements.canvas);
  resizeRenderer();

  function syncActiveWorld(frame) {
    const worldId = runtimeWorldIds[frame.activeWorldIndex];
    if (!worldId || worldId === state.runtime.worldId) return;
    const nextWorld = gameDefinition.worlds[worldId];
    activeWorld = nextWorld;
    state.runtime.worldId = worldId;
    worldSocket.setHidden(worldId === "settings");
    hud.setWorld(activeWorld, {
      lobby: worldId === "lobby",
      immersive: worldId === "settings",
    });
    connectWorld(worldId);
  }

  function render(delta) {
    const step = Math.min(delta, 0.05);
    const movement = state.runtime.settingsOpen
      ? { forward: 0, strafe: 0, sprinting: false }
      : getMovementInput(state);
    engine.setInput(
      movement.forward,
      movement.strafe,
      movement.sprinting,
      state.runtime.settingsOpen ? false : state.movement.jumpQueued,
      state.runtime.settingsOpen ? false : state.movement.climb,
      state.runtime.settingsOpen ? 0 : state.movement.lookX,
      state.runtime.settingsOpen ? 0 : state.movement.lookY,
      state.runtime.settingsOpen ? 0 : state.movement.zoomDelta,
    );
    state.movement.jumpQueued = false;
    state.movement.lookX = 0;
    state.movement.lookY = 0;
    state.movement.zoomDelta = 0;
    syncRemotePlayers();
    engine.step(step);
    handleUIEvents();
    flushNetworkMessages();
    flushAudioMessages();
    elements.worldShell?.classList.toggle(
      "is-shared-modal-open",
      engine.uiSharedModalVisible(),
    );

    const frame = engine.readFrame();
    syncActiveWorld(frame);
    settingsRoom.update(frame, state.runtime.worldId);
    state.runtime.engineFrame = frame;
    state.runtime.elapsed = frame.elapsed;
    if (state.runtime.worldId !== "settings") {
      worldSocket.sendMove({
        x: frame.player.position.x,
        y: frame.player.position.y,
        z: frame.player.position.z,
        yaw: frame.player.yaw,
        moving: frame.player.moving,
        sprinting: frame.player.sprinting,
        respawnEventId: frame.playerRespawnEventId,
      });
    }
    if (state.runtime.worldId === "lobby") {
      hud.updateLobby({
        totalPlayers: frame.totalPlayers,
        launchPadCounts: frame.launchPadCounts,
        isFull: frame.isFull,
      });
    }
    hud.updateLaunchStatus(frame);
    buildMode.update(frame);
    characterShowcase.update(frame);
    hud.setCameraMode(frame.camera.distance > 0.75);
    hud.updateMovementStatus(frame);
    hud.updateCompass(frame);
    renderer.render(engine.rendererHandle());
  }

  let disposed = false;
  let animationFrame = 0;
  let previousTime = performance.now();
  function animate(currentTime) {
    if (disposed) return;
    const delta = Math.min((currentTime - previousTime) / 1000, 0.05);
    previousTime = currentTime;
    render(delta);
    animationFrame = requestAnimationFrame(animate);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(animationFrame);
    resizeObserver.disconnect();
    controls.destroy();
    worldSocket.destroy();
    hud.destroy();
    characterShowcase.destroy();
    settingsRoom.destroy();
    buildMode.destroy();
    gameAudio.destroy();
    renderer.destroy();
    engine.destroy();
    window.removeEventListener("pagehide", dispose);
  }

  hud.markReady();
  animationFrame = requestAnimationFrame(animate);

  window.addEventListener("pagehide", dispose, { once: true });
  return { dispose };
}
