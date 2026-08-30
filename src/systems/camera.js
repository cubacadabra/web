import {
  initialView,
  playerConfig,
  zoomConfig,
} from "../config/gameConfig.js";
import { damp } from "../lib/math.js";

export function createCameraController({
  THREE,
  camera,
  playerAvatar,
  state,
  worldShell,
  onModeChange,
}) {
  let previousThirdPerson = null;

  function updateMode() {
    const isThirdPerson =
      state.cameraZoom.distance > zoomConfig.thirdPersonThreshold;

    if (isThirdPerson !== previousThirdPerson) {
      previousThirdPerson = isThirdPerson;
      playerAvatar.visible = isThirdPerson;
      worldShell?.classList.toggle("is-third-person", isThirdPerson);
      onModeChange?.(isThirdPerson);
    }

    return isThirdPerson;
  }

  function update(headBob) {
    const { player, view, cameraZoom, vectors } = state;
    const isThirdPerson = updateMode();

    playerAvatar.position.copy(player.position);
    playerAvatar.rotation.y = view.yaw;

    if (!isThirdPerson) {
      camera.rotation.order = "YXZ";
      camera.rotation.y = view.yaw;
      camera.rotation.x = view.pitch;
      camera.rotation.z = 0;
      camera.position.x = player.position.x;
      camera.position.y = player.position.y + playerConfig.eyeHeight + headBob;
      camera.position.z = player.position.z;
      return;
    }

    vectors.cameraTarget.set(
      player.position.x,
      player.position.y + 1.78,
      player.position.z,
    );

    const horizontalDistance = cameraZoom.distance * Math.cos(view.pitch);
    const verticalDistance = cameraZoom.distance * Math.sin(view.pitch);
    camera.position.x =
      player.position.x + Math.sin(view.yaw) * horizontalDistance;
    camera.position.y = Math.max(
      player.position.y + 0.55,
      player.position.y + 2.65 + verticalDistance,
    );
    camera.position.z =
      player.position.z + Math.cos(view.yaw) * horizontalDistance;
    camera.lookAt(vectors.cameraTarget);
  }

  function reset() {
    state.view.yaw = initialView.yaw;
    state.view.pitch = initialView.pitch;
    state.view.targetYaw = initialView.yaw;
    state.view.targetPitch = initialView.pitch;
    state.cameraZoom.distance = 0;
    state.cameraZoom.targetDistance = 0;
  }

  function smooth(delta) {
    state.view.yaw = damp(THREE, state.view.yaw, state.view.targetYaw, 10, delta);
    state.view.pitch = damp(
      THREE,
      state.view.pitch,
      state.view.targetPitch,
      10,
      delta,
    );
    state.cameraZoom.distance = damp(
      THREE,
      state.cameraZoom.distance,
      state.cameraZoom.targetDistance,
      9,
      delta,
    );
  }

  return { reset, smooth, update };
}
