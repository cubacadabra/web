import { playerConfig } from "../config/gameConfig.js";
import { clamp } from "../lib/math.js";

function isKeyDown(state, ...codes) {
  return codes.some((code) => state.keys.has(code));
}

export function getMovementAxes(state) {
  let forward = 0;
  let strafe = 0;

  if (isKeyDown(state, "KeyW", "ArrowUp")) forward += 1;
  if (isKeyDown(state, "KeyS", "ArrowDown")) forward -= 1;
  if (isKeyDown(state, "KeyD", "ArrowRight")) strafe += 1;
  if (isKeyDown(state, "KeyA", "ArrowLeft")) strafe -= 1;

  forward += -state.movement.joystickY;
  strafe += state.movement.joystickX;

  const inputLength = Math.hypot(forward, strafe);
  if (inputLength > 1) {
    forward /= inputLength;
    strafe /= inputLength;
  }

  return { forward, strafe };
}

function playerCanOccupy(state, obstacles, candidate) {
  const feet = state.player.position.y;
  const head = feet + playerConfig.bodyHeight;

  for (const obstacle of obstacles) {
    if (feet >= obstacle.top - 0.05 || head <= obstacle.bottom + 0.05) {
      continue;
    }

    const closestX = clamp(candidate.x, obstacle.minX, obstacle.maxX);
    const closestZ = clamp(candidate.z, obstacle.minZ, obstacle.maxZ);
    const distanceX = candidate.x - closestX;
    const distanceZ = candidate.z - closestZ;

    if (
      distanceX * distanceX + distanceZ * distanceZ <
      playerConfig.radius * playerConfig.radius
    ) {
      return false;
    }
  }

  return true;
}

function movePlayerHorizontally(state, obstacles, delta) {
  const limit = playerConfig.worldLimit - playerConfig.radius;
  const { player, vectors } = state;
  const { nextPlayerPosition } = vectors;

  nextPlayerPosition.copy(player.position);
  nextPlayerPosition.x = clamp(
    player.position.x + player.velocity.x * delta,
    -limit,
    limit,
  );
  if (playerCanOccupy(state, obstacles, nextPlayerPosition)) {
    player.position.x = nextPlayerPosition.x;
  } else {
    player.velocity.x = 0;
  }

  nextPlayerPosition.copy(player.position);
  nextPlayerPosition.z = clamp(
    player.position.z + player.velocity.z * delta,
    -limit,
    limit,
  );
  if (playerCanOccupy(state, obstacles, nextPlayerPosition)) {
    player.position.z = nextPlayerPosition.z;
  } else {
    player.velocity.z = 0;
  }

  if (Math.abs(player.position.x) >= limit && Math.abs(player.velocity.x) > 0) {
    player.velocity.x = 0;
  }
  if (Math.abs(player.position.z) >= limit && Math.abs(player.velocity.z) > 0) {
    player.velocity.z = 0;
  }
}

export function updatePlayer({ THREE, state, obstacles, delta, onStatusChange }) {
  const axes = getMovementAxes(state);
  const inputLength = Math.hypot(axes.forward, axes.strafe);
  const moving = inputLength > 0.01;
  const sprinting = moving && (
    isKeyDown(state, "ShiftLeft", "ShiftRight") || state.movement.mobileSprint
  );
  const { player, vectors } = state;

  vectors.forward.set(-Math.sin(state.view.yaw), 0, -Math.cos(state.view.yaw));
  vectors.right.set(Math.cos(state.view.yaw), 0, -Math.sin(state.view.yaw));
  vectors.moveDirection.set(0, 0, 0);
  vectors.moveDirection.addScaledVector(vectors.forward, axes.forward);
  vectors.moveDirection.addScaledVector(vectors.right, axes.strafe);
  if (vectors.moveDirection.lengthSq() > 1) vectors.moveDirection.normalize();

  const speed = sprinting ? playerConfig.runSpeed : playerConfig.walkSpeed;
  const targetVelocityX = vectors.moveDirection.x * speed;
  const targetVelocityZ = vectors.moveDirection.z * speed;
  const acceleration = player.grounded
    ? playerConfig.acceleration
    : playerConfig.airAcceleration;
  const blend = 1 - Math.exp(-acceleration * delta);

  player.velocity.x = THREE.MathUtils.lerp(
    player.velocity.x,
    targetVelocityX,
    blend,
  );
  player.velocity.z = THREE.MathUtils.lerp(
    player.velocity.z,
    targetVelocityZ,
    blend,
  );

  if (state.movement.jumpQueued && player.grounded) {
    player.velocity.y = playerConfig.jumpVelocity;
    player.grounded = false;
  }
  state.movement.jumpQueued = false;

  player.velocity.y -= playerConfig.gravity * delta;
  player.position.y += player.velocity.y * delta;

  if (player.position.y <= 0) {
    player.position.y = 0;
    player.velocity.y = 0;
    player.grounded = true;
  }

  movePlayerHorizontally(state, obstacles, delta);
  onStatusChange?.(moving, sprinting);

  return { moving, sprinting };
}
