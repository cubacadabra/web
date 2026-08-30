import * as THREE from "three";
import { colors } from "../config/gameConfig.js";
import { createEnvironment } from "../scene/createEnvironment.js";
import { createPlayerAvatar } from "../scene/createAvatar.js";
import { createScene } from "../scene/createScene.js";
import { createCameraController } from "../systems/camera.js";
import { bindControls } from "../systems/controls.js";
import { updatePlayer } from "../systems/player.js";
import { createGameState } from "../state/gameState.js";
import { getDomElements } from "../ui/dom.js";
import { createHudController } from "../ui/hud.js";

export function createGame() {
  const elements = getDomElements();
  const state = createGameState(THREE);
  const { renderer, scene, camera, world } = createScene({
    THREE,
    canvas: elements.canvas,
  });
  const environment = createEnvironment({ THREE, scene, world, colors });
  const playerAvatar = createPlayerAvatar({ THREE, world, colors });
  const hud = createHudController({ THREE, elements, state });
  const cameraController = createCameraController({
    THREE,
    camera,
    playerAvatar,
    state,
    worldShell: elements.worldShell,
    onModeChange: hud.setCameraMode,
  });

  bindControls({
    elements,
    state,
    onDismissHint: hud.dismissHint,
    onResetView: cameraController.reset,
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
    const { spawnPad, coralBlock, butterBlock, blueBlock, clouds } =
      environment.animated;

    spawnPad.rotation.y = Math.sin(elapsed * 0.22) * 0.015;
    coralBlock.rotation.y = Math.sin(elapsed * 0.16) * 0.008;
    butterBlock.rotation.y = Math.sin(elapsed * 0.13 + 1) * 0.006;
    blueBlock.rotation.y = Math.sin(elapsed * 0.18 + 2) * 0.008;
    clouds[0].position.x = -18 + Math.sin(elapsed * 0.025) * 1.2;
    clouds[1].position.x = 24 + Math.sin(elapsed * 0.02 + 1) * 1.6;
    clouds[2].position.x = 42 + Math.sin(elapsed * 0.018 + 2) * 1.4;
  }

  function render(delta) {
    const step = Math.min(delta, 0.05);
    state.runtime.elapsed += step;

    const currentMovement = updatePlayer({
      THREE,
      state,
      obstacles: environment.obstacles,
      delta: step,
      onStatusChange: hud.updateMovementStatus,
    });

    cameraController.smooth(step);

    const headBob = currentMovement.moving && state.player.grounded
      ? Math.sin(
        state.runtime.elapsed * (currentMovement.sprinting ? 14 : 10),
      ) * (currentMovement.sprinting ? 0.045 : 0.025)
      : 0;
    cameraController.update(headBob);
    animateEnvironment(state.runtime.elapsed);
    hud.updateCompass();
    renderer.render(scene, camera);
  }

  const clock = new THREE.Clock();
  function animate() {
    render(clock.getDelta());
    requestAnimationFrame(animate);
  }

  hud.markReady();
  animate();
}
