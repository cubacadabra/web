import * as THREE from "three";
import { colors } from "../config/gameConfig.js";
import { createRustEngine } from "../engine/wasm.js";
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
  const isTouchDevice =
    typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
  elements.worldShell?.classList.toggle("is-touch-device", isTouchDevice);
  const engine = await createRustEngine();
  const state = createGameState();
  const { renderer, scene, camera, world } = createScene({
    THREE,
    canvas: elements.canvas,
  });
  const environment = createEnvironment({ THREE, scene, world, colors });
  const playerAvatar = createPlayerAvatar({ THREE, world, colors });
  const npcManager = createNpcManager({
    THREE,
    world,
    colors,
    createAvatar: createPlayerAvatar,
  });
  const hud = createHudController({ THREE, elements, state });
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

  function animateEnvironment(elapsed) {
    const { spawnPad, coralBlock, butterBlock, blueBlock, clouds, meetingPoints } =
      environment.animated;

    spawnPad.rotation.y = Math.sin(elapsed * 0.22) * 0.015;
    coralBlock.rotation.y = Math.sin(elapsed * 0.16) * 0.008;
    butterBlock.rotation.y = Math.sin(elapsed * 0.13 + 1) * 0.006;
    blueBlock.rotation.y = Math.sin(elapsed * 0.18 + 2) * 0.008;
    clouds[0].position.x = -18 + Math.sin(elapsed * 0.025) * 1.2;
    clouds[1].position.x = 24 + Math.sin(elapsed * 0.02 + 1) * 1.6;
    clouds[2].position.x = 42 + Math.sin(elapsed * 0.018 + 2) * 1.4;

    meetingPoints.forEach((meetingPoint, index) => {
      const pulse = 1 + Math.sin(elapsed * 2.2 + index * 1.7) * 0.045;
      meetingPoint.ring.scale.setScalar(pulse);
      meetingPoint.beacons.forEach((beacon, beaconIndex) => {
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
    state.runtime.engineFrame = frame;
    state.runtime.elapsed = frame.elapsed;
    const lobbyStatus = npcManager.update(frame);
    hud.updateLobby(lobbyStatus);

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
