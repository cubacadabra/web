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
export function getMovementInput(state) {
  const axes = getMovementAxes(state);
  const moving = Math.hypot(axes.forward, axes.strafe) > 0.01;
  return {
    ...axes,
    moving,
    sprinting: moving && (
      isKeyDown(state, "ShiftLeft", "ShiftRight") || state.movement.mobileSprint
    ),
  };
}
