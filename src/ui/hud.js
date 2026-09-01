import { clamp } from "../lib/math.js";
import { launchPads } from "../config/gameConfig.js";

const LAUNCH_COUNTDOWN_PHASE = 1;
const LAUNCH_COMPLETE_PHASE = 2;

function getHeading(THREE, yaw) {
  const fullTurn = Math.PI * 2;
  const wrappedYaw = ((-yaw % fullTurn) + fullTurn) % fullTurn;
  return Math.round(THREE.MathUtils.radToDeg(wrappedYaw)) % 360;
}

function getCardinalDirection(degrees) {
  if (degrees >= 315 || degrees < 45) return "N";
  if (degrees < 135) return "E";
  if (degrees < 225) return "S";
  return "W";
}

export function createHudController({ THREE, elements, state }) {
  function dismissHint() {
    if (state.runtime.hintDismissed) return;
    state.runtime.hintDismissed = true;
    elements.lookHint?.classList.add("is-hidden");
  }

  function setCameraMode(isThirdPerson) {
    if (elements.cameraMode) {
      elements.cameraMode.textContent = isThirdPerson
        ? "Third person"
        : "First person";
    }
    elements.worldShell?.classList.toggle("is-third-person", isThirdPerson);
  }

  function updateMovementStatus(frame) {
    const { player } = frame;
    const label = !player.grounded
      ? "Jumping"
      : player.sprinting
        ? "Running"
        : player.moving
          ? "Walking"
          : "Idle / ready";

    if (label !== state.runtime.lastMovementLabel) {
      state.runtime.lastMovementLabel = label;
      if (elements.movementState) elements.movementState.textContent = label;
    }

    elements.worldShell?.classList.toggle("is-running", player.sprinting);
    elements.worldShell?.classList.toggle("is-jumping", !player.grounded);
  }

  function updateCompass(frame) {
    const heading = getHeading(THREE, frame.camera.yaw);
    const cardinal = getCardinalDirection(heading);
    if (elements.headingValue) {
      elements.headingValue.textContent = `${cardinal} ${heading}°`;
    }
    if (elements.compassNeedle) {
      elements.compassNeedle.style.transform =
        `translate(-50%, -50%) rotate(${clamp(heading, 0, 359)}deg)`;
    }
  }

  function updateLobby({ totalPlayers, launchPadCounts, isFull }) {
    if (elements.playerCount) {
      elements.playerCount.textContent = `${totalPlayers} / 18`;
    }
    if (elements.lobbyCopy) {
      elements.lobbyCopy.textContent = isFull
        ? "Lobby full · choose a gate"
        : "Players are finding their launch pads";
    }
    launchPadCounts.forEach((count, index) => {
      if (elements.launchPadCounts?.[index]) {
        elements.launchPadCounts[index].textContent = String(count).padStart(2, "0");
      }
    });
  }

  function updateLaunchStatus(frame) {
    const { launchPads: padStates = [], playerLaunchPad = -1 } = frame;
    const activeIndex = playerLaunchPad >= 0
      ? playerLaunchPad
      : padStates.findIndex((pad) => pad.phase === LAUNCH_COUNTDOWN_PHASE);
    const fallbackIndex = activeIndex >= 0
      ? activeIndex
      : padStates.findIndex((pad) => pad.phase === LAUNCH_COMPLETE_PHASE);
    const padIndex = activeIndex >= 0 ? activeIndex : fallbackIndex;
    const padState = padStates[padIndex];
    const pad = launchPads[padIndex];

    if (frame.launchEventId !== state.runtime.lastLaunchEventId) {
      state.runtime.lastLaunchEventId = frame.launchEventId;
    }

    elements.worldShell?.classList.toggle(
      "is-countdown",
      padState?.phase === LAUNCH_COUNTDOWN_PHASE,
    );
    elements.worldShell?.classList.toggle(
      "is-launch-complete",
      padState?.phase === LAUNCH_COMPLETE_PHASE,
    );

    if (!elements.launchCountdown || !elements.launchCopy) return;

    if (!padState || !pad) {
      elements.launchCountdown.textContent = "—";
      elements.launchCopy.textContent = "Stand on a pad to join the next launch";
      elements.launchStatus?.classList.remove("is-countdown", "is-complete");
      return;
    }

    const isCountdown = padState.phase === LAUNCH_COUNTDOWN_PHASE;
    const isComplete = padState.phase === LAUNCH_COMPLETE_PHASE;
    elements.launchStatus?.classList.toggle("is-countdown", isCountdown);
    elements.launchStatus?.classList.toggle("is-complete", isComplete);

    if (isCountdown) {
      const seconds = Math.max(0, Math.ceil(padState.seconds));
      const playerLabel = padState.occupants === 1 ? "player" : "players";
      elements.launchCountdown.textContent = `00:${String(seconds).padStart(2, "0")}`;
      elements.launchCopy.textContent = `${pad.label} · ${padState.occupants} ${playerLabel} on pad`;
    } else if (isComplete) {
      elements.launchCountdown.textContent = "OPEN";
      elements.launchCopy.textContent = `${pad.label} · game handoff ready`;
    } else {
      elements.launchCountdown.textContent = "—";
      elements.launchCopy.textContent = "Stand on a pad to join the next launch";
    }
  }

  function markReady() {
    elements.worldShell?.classList.add("is-ready");
    elements.loadingState?.classList.add("is-ready");
  }

  function markError(message) {
    if (elements.loadingState) {
      elements.loadingState.textContent = message;
      elements.loadingState.classList.add("is-error");
    }
  }

  return {
    dismissHint,
    setCameraMode,
    updateMovementStatus,
    updateLobby,
    updateLaunchStatus,
    updateCompass,
    markReady,
    markError,
  };
}
