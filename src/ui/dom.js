function getElement(selector) {
  return document.querySelector(selector);
}

export function getDomElements() {
  const canvas = getElement("#world-canvas");

  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error("The world canvas could not be found.");
  }

  return {
    canvas,
    worldShell: getElement("#world-shell"),
    lookHint: getElement("#look-hint"),
    loadingState: getElement("#loading-state"),
    resetButton: getElement("#reset-view"),
    headingValue: getElement("#heading-value"),
    compassNeedle: getElement("#compass-needle"),
    cameraMode: getElement("#camera-mode"),
    movementState: getElement("#movement-state"),
    joystickElement: getElement("#joystick"),
    joystickKnob: getElement("#joystick-knob"),
    runToggle: getElement("#run-toggle"),
    jumpButton: getElement("#jump-button"),
  };
}
