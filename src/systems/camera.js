import { playerPresentationConfig, zoomConfig } from "../config/clientConfig.js";

export function createCameraController({
  THREE,
  camera,
  playerAvatar,
  worldShell,
  onModeChange,
}) {
  let previousThirdPerson = null;
  const cameraTarget = new THREE.Vector3();

  function updateMode(distance) {
    const isThirdPerson =
      distance > zoomConfig.thirdPersonThreshold;

    if (isThirdPerson !== previousThirdPerson) {
      previousThirdPerson = isThirdPerson;
      playerAvatar.visible = isThirdPerson;
      worldShell?.classList.toggle("is-third-person", isThirdPerson);
      onModeChange?.(isThirdPerson);
    }

    return isThirdPerson;
  }

  function update(frame, headBob) {
    const { player, camera: view } = frame;
    const isThirdPerson = updateMode(frame.camera.distance);

    playerAvatar.position.set(
      player.position.x,
      player.position.y,
      player.position.z,
    );
    playerAvatar.rotation.y = view.yaw;

    if (!isThirdPerson) {
      camera.rotation.order = "YXZ";
      camera.rotation.y = view.yaw;
      camera.rotation.x = view.pitch;
      camera.rotation.z = 0;
      camera.position.x = player.position.x;
      camera.position.y = player.position.y + playerPresentationConfig.eyeHeight + headBob;
      camera.position.z = player.position.z;
      return;
    }

    cameraTarget.set(
      player.position.x,
      player.position.y + 1.78,
      player.position.z,
    );

    const horizontalDistance = frame.camera.distance * Math.cos(view.pitch);
    const verticalDistance = frame.camera.distance * Math.sin(view.pitch);
    camera.position.x =
      player.position.x + Math.sin(view.yaw) * horizontalDistance;
    camera.position.y = Math.max(
      player.position.y + 0.55,
      player.position.y + 2.65 + verticalDistance,
    );
    camera.position.z =
      player.position.z + Math.cos(view.yaw) * horizontalDistance;
    camera.lookAt(cameraTarget);
  }

  function reset() {
    previousThirdPerson = null;
  }

  return { reset, update };
}
