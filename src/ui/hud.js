import { clamp } from "../lib/math.js";

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

  function updateLobby({ totalPlayers, meetingCounts, isFull }) {
    if (elements.playerCount) {
      elements.playerCount.textContent = `${totalPlayers} / 18`;
    }
    if (elements.lobbyCopy) {
      elements.lobbyCopy.textContent = isFull
        ? "Lobby full · choose a gate"
        : "Players are finding their gates";
    }
    meetingCounts.forEach((count, index) => {
      if (elements.meetingCounts?.[index]) {
        elements.meetingCounts[index].textContent = String(count).padStart(2, "0");
      }
    });
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
    updateCompass,
    markReady,
    markError,
  };
}
