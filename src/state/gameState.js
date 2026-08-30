import { initialView } from "../config/gameConfig.js";

export function createGameState(THREE) {
  return {
    view: {
      yaw: initialView.yaw,
      pitch: initialView.pitch,
      targetYaw: initialView.yaw,
      targetPitch: initialView.pitch,
    },
    cameraZoom: {
      distance: 0,
      targetDistance: 0,
    },
    player: {
      position: new THREE.Vector3(0, 0, 11.5),
      velocity: new THREE.Vector3(),
      grounded: true,
    },
    keys: new Set(),
    movement: {
      joystickX: 0,
      joystickY: 0,
      mobileSprint: false,
      jumpQueued: false,
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
    vectors: {
      forward: new THREE.Vector3(),
      right: new THREE.Vector3(),
      moveDirection: new THREE.Vector3(),
      nextPlayerPosition: new THREE.Vector3(),
      cameraTarget: new THREE.Vector3(),
    },
    runtime: {
      elapsed: 0,
      hintDismissed: false,
      lastMovementLabel: "",
    },
  };
}
