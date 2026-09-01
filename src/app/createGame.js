import * as THREE from "three";
import { createRustEngine } from "../engine/wasm.js";
import { loadGamePackage } from "../game/loadGamePackage.js";
import { createEnvironment } from "../scene/createEnvironment.js";
import { createPlayerAvatar } from "../scene/createAvatar.js";
import { createScene } from "../scene/createScene.js";
import { createCameraController } from "../systems/camera.js";
import { bindControls } from "../systems/controls.js";
import { createNpcManager } from "../systems/npcs.js";
import { getMovementInput } from "../systems/player.js";
import { createGameState } from "../state/gameState.js";
import { getDomElements } from "../ui/dom.js";
import { createHudController } from "../ui/hud.js";

export async function createGame() {
  const elements = getDomElements();
  const gameDefinition = await loadGamePackage();
  const isTouchDevice =
    typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
  elements.worldShell?.classList.toggle("is-touch-device", isTouchDevice);
  const engine = await createRustEngine();
  engine.loadGameScript(gameDefinition.script);
  const runtimeWorldIds = Object.keys(gameDefinition.worlds);
  engine.configureWorlds(
    runtimeWorldIds.map((id) => ({ id, definition: gameDefinition.worlds[id] })),
    gameDefinition.activeWorldId,
  );
  const state = createGameState();
  state.runtime.worldId = gameDefinition.activeWorldId;
  const { renderer, scene, camera, world } = createScene({
    THREE,
    canvas: elements.canvas,
  });
  let activeWorld = gameDefinition;
  let environment = createEnvironment({ THREE, scene, world, gameDefinition: activeWorld });
  const playerAvatar = createPlayerAvatar({
    THREE,
    world,
    colors: gameDefinition.palette,
  });
  const npcManager = createNpcManager({
    THREE,
    world,
    colors: gameDefinition.palette,
    createAvatar: createPlayerAvatar,
  });
  const hud = createHudController({ THREE, elements, state, gameDefinition });
  const cameraController = createCameraController({
    THREE,
    camera,
    playerAvatar,
    worldShell: elements.worldShell,
    onModeChange: hud.setCameraMode,
  });

  bindControls({
    elements,
    state,
    onDismissHint: hud.dismissHint,
    onResetView: () => {
      engine.resetView();
      cameraController.reset();
    },
    onLook: (horizontal, vertical) => {
      state.movement.lookX += horizontal;
      state.movement.lookY += vertical;
    },
    onZoom: (amount) => {
      state.movement.zoomDelta += amount;
    },
  });

  function resizeRenderer() {
    const width = elements.canvas.clientWidth;
    const height = elements.canvas.clientHeight;
    if (!width || !height) return;

    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = width < 700 ? 64 : 58;
    camera.updateProjectionMatrix();
  }

  const resizeObserver = new ResizeObserver(resizeRenderer);
  resizeObserver.observe(elements.canvas);
  resizeRenderer();

  function syncActiveWorld(frame) {
    const worldId = runtimeWorldIds[frame.activeWorldIndex];
    if (!worldId || worldId === state.runtime.worldId) return;
    const nextWorld = gameDefinition.worlds[worldId];
    environment.root.removeFromParent();
    activeWorld = nextWorld;
    environment = createEnvironment({
      THREE,
      scene,
      world,
      gameDefinition: activeWorld,
    });
    hud.setWorld(activeWorld);
    state.runtime.worldId = worldId;
  }

  function animateEnvironment(elapsed) {
    const { spawnPad, blocks, clouds, launchPads: renderedLaunchPads } =
      environment.animated;

    if (spawnPad) spawnPad.rotation.y = Math.sin(elapsed * 0.22) * 0.015;
    blocks.forEach((block, index) => {
      block.rotation.y = Math.sin(elapsed * (0.13 + index * 0.01) + index) * 0.008;
    });
    clouds.forEach((cloud, index) => {
      cloud.position.x = cloud.userData.initialX +
        Math.sin(elapsed * (0.02 + index * 0.003) + index) * (1.2 + index * 0.2);
    });

    renderedLaunchPads.forEach((launchPad, index) => {
      const pulse = 1 + Math.sin(elapsed * 2.2 + index * 1.7) * 0.045;
      launchPad.ring.scale.setScalar(pulse);
      launchPad.beacons.forEach((beacon, beaconIndex) => {
        beacon.position.y = 1.35 + Math.sin(elapsed * 2.6 + index + beaconIndex) * 0.12;
      });
    });
  }

  function render(delta) {
    const step = Math.min(delta, 0.05);
    const movement = getMovementInput(state);
    engine.setInput(
      movement.forward,
      movement.strafe,
      movement.sprinting,
      state.movement.jumpQueued,
      state.movement.lookX,
      state.movement.lookY,
      state.movement.zoomDelta,
    );
    state.movement.jumpQueued = false;
    state.movement.lookX = 0;
    state.movement.lookY = 0;
    state.movement.zoomDelta = 0;
    engine.step(step);

    const frame = engine.readFrame();
    syncActiveWorld(frame);
    state.runtime.engineFrame = frame;
    state.runtime.elapsed = frame.elapsed;
    const lobbyStatus = npcManager.update(frame);
    if (state.runtime.worldId === "lobby") hud.updateLobby(lobbyStatus);
    hud.updateLaunchStatus(frame);

    const headBob = frame.player.moving && frame.player.grounded
      ? Math.sin(
        frame.elapsed * (frame.player.sprinting ? 14 : 10),
      ) * (frame.player.sprinting ? 0.045 : 0.025)
      : 0;
    cameraController.update(frame, headBob);
    animateEnvironment(frame.elapsed);
    hud.updateMovementStatus(frame);
    hud.updateCompass(frame);
    renderer.render(scene, camera);
  }

  const clock = new THREE.Clock();
  function animate() {
    render(clock.getDelta());
    requestAnimationFrame(animate);
  }

  hud.markReady();
  animate();

  window.addEventListener("pagehide", () => engine.destroy(), { once: true });
}
