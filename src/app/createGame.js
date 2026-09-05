import { createRustEngine } from "../engine/wasm.js";
import { createRustRenderer } from "../engine/renderer.js";
import { loadGamePackage } from "../game/loadGamePackage.js";
import { createWorldSocket } from "../network/worldSocket.js";
import { bindControls } from "../systems/controls.js";
import { getMovementInput } from "../systems/player.js";
import { createGameState } from "../state/gameState.js";
import { createSettingsRoomController } from "../ui/settingsRoom.js";
import { createBuildModeController } from "../ui/buildMode.js";
import { getDomElements } from "../ui/dom.js";
import { createHudController } from "../ui/hud.js";
import { createCharacterShowcaseController } from "../ui/characterShowcase.js";
import { getCurrentUser } from "../auth/session.js";

export async function createGame() {
  const elements = getDomElements();
  const gameDefinition = await loadGamePackage();
  const isTouchDevice =
    typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
  elements.worldShell?.classList.toggle("is-touch-device", isTouchDevice);
  const renderer = await createRustRenderer({ canvas: elements.canvas });
  const engine = createRustEngine(renderer.wasmExports);
  const engineCapabilities = engine.getCharacterShowcaseCapabilities?.() ?? {};
  engine.loadGamePackage(gameDefinition.manifestSource);
  let localAppearance = gameDefinition.avatars?.player?.character ?? null;
  try {
    const storedAppearance = window.localStorage.getItem("cubacadabra.character-appearance");
    if (storedAppearance) localAppearance = JSON.parse(storedAppearance);
  } catch {
    // The bundled package appearance remains the safe offline default.
  }
  if (localAppearance) engine.setLocalAppearance(JSON.stringify(localAppearance));
  engine.loadGameScript(gameDefinition.script);
  engine.setAuthenticated(Boolean(await getCurrentUser()));
  const runtimeWorldIds = gameDefinition.runtimeWorldIds;
  const state = createGameState();
  state.runtime.worldId = gameDefinition.activeWorldId;
  let activeWorld = gameDefinition.worlds[gameDefinition.activeWorldId];
  const remotePlayers = new Map();
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
    onAppearanceChange: (appearance) => {
      try {
        window.localStorage.setItem("cubacadabra.character-appearance", JSON.stringify(appearance));
      } catch {
        // The appearance still applies to the current engine session.
      }
      worldSocket?.setAppearance(appearance);
    },
  });
  worldSocket = createWorldSocket({
    gameId: gameDefinition.gameId,
    onEvent: (event) => {
      hud.showWorldEvent(event);
      if (event.type === "player_leave") remotePlayers.delete(event.id);
      if (event.type === "player_join" && !event.isSelf) {
        remotePlayers.set(event.id, {
          id: event.id,
          generation: event.generation ?? 0,
          position: [0, 0, 0],
          yaw: 0,
          moving: false,
          sprinting: false,
          appearance: event.appearance ?? null,
          motionSequence: 0,
        });
      }
      if (event.type === "appearance" && remotePlayers.has(event.id)) {
        remotePlayers.get(event.id).appearance = event.appearance ?? null;
      }
    },
    onMove: (event) => {
      if (event.isSelf) {
        if (event.corrected) {
          engine.reconcilePlayer({ x: event.x, y: event.y, z: event.z }, event.yaw);
        }
        return;
      }
      remotePlayers.set(event.id, {
        id: event.id,
        generation: event.generation ?? remotePlayers.get(event.id)?.generation ?? 0,
        position: [event.x, event.y, event.z],
        yaw: event.yaw,
        moving: event.moving,
        sprinting: event.sprinting,
        motionSequence: event.motionSequence ?? 0,
        appearance: remotePlayers.get(event.id)?.appearance ?? null,
      });
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
    onStatusChange: hud.setConnectionStatus,
  });
  worldSocket.setAppearance(localAppearance);
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
      const lobbyIndex = runtimeWorldIds.indexOf("lobby");
      if (lobbyIndex >= 0) engine.startWorld(lobbyIndex);
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

  let connectedWorldId = null;

  function syncRemotePlayers() {
    if (state.runtime.worldId === "settings") {
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
    if (engineCapabilities.persistentIdentity) {
      remoteSequence += 1;
      engine.applyRemoteUpdate(JSON.stringify({
        version: 1,
        sequence: remoteSequence,
        worldId: state.runtime.worldId,
        players: players.map((player) => ({
          id: player.id,
          generation: player.generation,
          position: player.position,
          yaw: player.yaw,
          moving: player.moving,
          sprinting: player.sprinting,
          motionSequence: player.motionSequence,
          ...(player.appearance ? { appearance: player.appearance } : {}),
        })),
      }));
      return;
    }
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
    renderer.destroy();
    engine.destroy();
    window.removeEventListener("pagehide", dispose);
  }

  hud.markReady();
  animationFrame = requestAnimationFrame(animate);

  window.addEventListener("pagehide", dispose, { once: true });
  return { dispose };
}
