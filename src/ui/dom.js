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
    worldStatus: getElement("#world-status"),
    statusDot: getElement("#status-dot"),
    connectionStatus: getElement("#connection-status"),
    worldEvent: getElement("#world-event"),
    worldEventCopy: getElement("#world-event-copy"),
    settingsRoomPanel: getElement("#settings-room-panel"),
    settingsUsernameForm: getElement("#settings-username-form"),
    settingsUsernameInput: getElement("#settings-username-input"),
    settingsUsernameStatus: getElement("#settings-username-status"),
    settingsCancelButton: getElement("#settings-cancel-button"),
    settingsCancelButtonSecondary: getElement("#settings-cancel-button-secondary"),
    resetButton: getElement("#reset-view"),
    headingValue: getElement("#heading-value"),
    compassNeedle: getElement("#compass-needle"),
    cameraMode: getElement("#camera-mode"),
    movementState: getElement("#movement-state"),
    playerCount: getElement("#player-count"),
    lobbyCopy: getElement("#lobby-copy"),
    lobbyStatus: getElement("#lobby-status"),
    sceneEyebrow: getElement("#scene-eyebrow"),
    sceneTitle: getElement("#scene-title"),
    sceneDescription: getElement("#scene-description"),
    launchStatus: getElement("#launch-status"),
    launchCountdown: getElement("#launch-countdown"),
    launchCopy: getElement("#launch-copy"),
    launchPadList: getElement("#launch-pad-list"),
    buildPanel: getElement("#build-panel"),
    buildPhaseLabel: getElement("#build-phase-label"),
    buildPrompt: getElement("#build-prompt"),
    buildRoundMeta: getElement("#build-round-meta"),
    buildStatus: getElement("#build-status"),
    buildSaveButton: getElement("#build-save"),
    buildReturnButton: getElement("#build-return"),
    buildShapeButton: getElement("#build-shape"),
    buildColorButton: getElement("#build-color"),
    buildToolButtons: [...document.querySelectorAll("[data-build-tool]")],
    joystickElement: getElement("#joystick"),
    joystickKnob: getElement("#joystick-knob"),
    runToggle: getElement("#run-toggle"),
    jumpButton: getElement("#jump-button"),
    zoomOutButton: getElement("#zoom-out"),
    zoomInButton: getElement("#zoom-in"),
  };
}
