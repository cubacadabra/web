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
    playerCount: getElement("#player-count"),
    lobbyCopy: getElement("#lobby-copy"),
    sceneEyebrow: getElement("#scene-eyebrow"),
    sceneTitle: getElement("#scene-title"),
    sceneDescription: getElement("#scene-description"),
    launchStatus: getElement("#launch-status"),
    launchCountdown: getElement("#launch-countdown"),
    launchCopy: getElement("#launch-copy"),
    launchPadList: getElement("#launch-pad-list"),
    joystickElement: getElement("#joystick"),
    joystickKnob: getElement("#joystick-knob"),
    runToggle: getElement("#run-toggle"),
    jumpButton: getElement("#jump-button"),
    zoomOutButton: getElement("#zoom-out"),
    zoomInButton: getElement("#zoom-in"),
  };
}
