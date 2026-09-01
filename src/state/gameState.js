export function createGameState() {
  return {
    keys: new Set(),
    movement: {
      joystickX: 0,
      joystickY: 0,
      mobileSprint: false,
      jumpQueued: false,
      lookX: 0,
      lookY: 0,
      zoomDelta: 0,
    },
    pointer: {
      active: false,
      id: null,
      x: 0,
      y: 0,
    },
    joystickPointer: {
      active: false,
      id: null,
    },
    runtime: {
      elapsed: 0,
      hintDismissed: false,
      lastMovementLabel: "",
      lastLaunchEventId: 0,
      engineFrame: null,
      worldId: "lobby",
    },
  };
}
