import { clamp } from "../lib/math.js";

const LAUNCH_COUNTDOWN_PHASE = 1;
const LAUNCH_COMPLETE_PHASE = 2;

function getHeading(yaw) {
  const fullTurn = Math.PI * 2;
  const wrappedYaw = ((-yaw % fullTurn) + fullTurn) % fullTurn;
  return Math.round((wrappedYaw * 180) / Math.PI) % 360;
}

function getCardinalDirection(degrees) {
  if (degrees >= 315 || degrees < 45) return "N";
  if (degrees < 135) return "E";
  if (degrees < 225) return "S";
  return "W";
}

export function createHudController({ elements, state, gameDefinition }) {
  let activeWorld = gameDefinition;
  let worldEventTimer = 0;
  let worldEventHideTimer = 0;
  const launchPadCountElements = [];

  function playerLabel(playerId) {
    const [platform] = playerId.split("-");
    const platformLabel = platform === "ios"
      ? "iOS"
      : platform === "web"
        ? "Web"
        : "Player";
    return `${platformLabel} player ${playerId.slice(-4).toUpperCase()}`;
  }

  function setConnectionStatus(status) {
    const labels = {
      connecting: "Connecting",
      connected: "Cloud live",
      reconnecting: "Reconnecting",
      disconnected: "Offline",
    };
    const label = labels[status] ?? labels.disconnected;
    if (elements.connectionStatus) elements.connectionStatus.textContent = label;
    elements.worldStatus?.setAttribute("data-state", status);
    elements.statusDot?.setAttribute("data-state", status);
  }

  function showWorldEvent(event) {
    if (event.isSelf || !elements.worldEvent || !elements.worldEventCopy) return;

    window.clearTimeout(worldEventTimer);
    window.clearTimeout(worldEventHideTimer);
    const action = event.type === "player_join" ? "joined the world" : "left the world";
    elements.worldEventCopy.textContent = `${playerLabel(event.id)} ${action}`;
    elements.worldEvent.hidden = false;
    requestAnimationFrame(() => elements.worldEvent?.classList.add("is-visible"));

    worldEventTimer = window.setTimeout(() => {
      elements.worldEvent?.classList.remove("is-visible");
      worldEventHideTimer = window.setTimeout(() => {
        if (elements.worldEvent && !elements.worldEvent.classList.contains("is-visible")) {
          elements.worldEvent.hidden = true;
        }
      }, 220);
    }, 4_000);
  }

  function renderWorldDetails() {
    const scene = activeWorld.scene ?? {};
    if (elements.sceneEyebrow) elements.sceneEyebrow.textContent = scene.eyebrow ?? "";
    if (elements.sceneTitle) elements.sceneTitle.textContent = scene.title ?? "";
    if (elements.sceneDescription) {
      elements.sceneDescription.textContent = scene.description ?? "";
    }
  }

  function renderLaunchPadRows() {
    if (!elements.launchPadList) return;
    elements.launchPadList.replaceChildren();
    launchPadCountElements.length = 0;
    (activeWorld.launchPads ?? []).forEach((pad) => {
      const row = document.createElement("div");
      row.className = "meeting-row";

      const swatch = document.createElement("span");
      swatch.className = "meeting-swatch";
      swatch.setAttribute("aria-hidden", "true");
      swatch.style.backgroundColor = `#${pad.color.toString(16).padStart(6, "0")}`;

      const label = document.createElement("span");
      label.textContent = pad.label;

      const count = document.createElement("strong");
      count.textContent = "00";

      row.append(swatch, label, count);
      elements.launchPadList.append(row);
      launchPadCountElements.push(count);
    });
  }

  function setWorld(nextWorld, { lobby = false } = {}) {
    activeWorld = nextWorld;
    renderWorldDetails();
    renderLaunchPadRows();
    if (elements.lobbyStatus) elements.lobbyStatus.hidden = !lobby;
    elements.worldShell?.classList.toggle("is-session-world", !lobby);
    elements.worldShell?.classList.remove("is-countdown", "is-launch-complete");
  }

  setWorld(gameDefinition, { lobby: true });

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
    const heading = getHeading(frame.camera.yaw);
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
      elements.playerCount.textContent = `${totalPlayers} / ${activeWorld.scene?.maxPlayers ?? 18}`;
    }
    if (elements.lobbyCopy) {
      elements.lobbyCopy.textContent = isFull
        ? "Lobby full · choose a gate"
        : "Players are finding their launch pads";
    }
    launchPadCounts.forEach((count, index) => {
      if (launchPadCountElements[index]) {
        launchPadCountElements[index].textContent = String(count).padStart(2, "0");
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
    const pad = activeWorld.launchPads?.[padIndex];

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

  function destroy() {
    window.clearTimeout(worldEventTimer);
    window.clearTimeout(worldEventHideTimer);
  }

  return {
    dismissHint,
    setConnectionStatus,
    showWorldEvent,
    setWorld,
    setCameraMode,
    updateMovementStatus,
    updateLobby,
    updateLaunchStatus,
    updateCompass,
    markReady,
    markError,
    destroy,
  };
}
