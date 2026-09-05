import { backendApiUrl } from "../config/clientConfig.js";

const USERNAME_MAX_LENGTH = 24;

export function createSettingsRoomController({ elements, state, worldSocket, engine }) {
  let isOpen = false;
  let roomState = 0;
  let activeUsername = "";
  let session = { authenticated: false, hasUsername: false };
  let waitingForAgeGateSession = false;

  function setMode(mode) {
    const isAgeMode = mode === "age";
    if (elements.settingsAgeForm) elements.settingsAgeForm.hidden = !isAgeMode;
    if (elements.settingsUsernameForm) elements.settingsUsernameForm.hidden = isAgeMode;
    const title = elements.settingsRoomPanel?.querySelector("#settings-room-title");
    if (title) title.textContent = isAgeMode ? "Unlock player names" : "Edit username";
    if (!isOpen) return;

    const input = isAgeMode ? elements.settingsDobInput : elements.settingsUsernameInput;
    input?.focus({ preventScroll: true });
    input?.select?.();
  }

  function setOpen(nextOpen) {
    isOpen = nextOpen;
    state.runtime.settingsOpen = nextOpen;
    if (!elements.settingsRoomPanel) return;
    elements.settingsRoomPanel.hidden = !nextOpen;
    elements.settingsRoomPanel.setAttribute("aria-hidden", String(!nextOpen));
    if (nextOpen) {
      if (session.authenticated) {
        elements.settingsUsernameInput.value = activeUsername;
        setMode("username");
      } else {
        setMode("age");
      }
    } else {
      elements.canvas.focus({ preventScroll: true });
    }
  }

  function setStatus(message, type = "") {
    if (!elements.settingsUsernameStatus) return;
    elements.settingsUsernameStatus.textContent = message;
    elements.settingsUsernameStatus.dataset.state = type;
  }

  function setAgeStatus(message, type = "") {
    if (!elements.settingsAgeStatus) return;
    elements.settingsAgeStatus.textContent = message;
    elements.settingsAgeStatus.dataset.state = type;
  }

  function interact() {
    if (roomState !== 2 || isOpen) return false;
    if (session.authenticated) {
      setStatus("Choose a unique name using 2–24 letters, numbers, spaces, _ or -.");
    } else {
      setAgeStatus("Your date of birth is used to check which features are available.");
    }
    setOpen(true);
    return true;
  }

  async function handleAgeSubmit(event) {
    event.preventDefault();
    const dob = elements.settingsDobInput?.value || "";
    if (!dob) {
      setAgeStatus("Enter your date of birth to continue.", "error");
      return;
    }

    const submitButton = elements.settingsAgeForm?.querySelector("button[type=submit]");
    if (submitButton) submitButton.disabled = true;
    setAgeStatus("Checking…", "pending");
    try {
      const response = await fetch(backendApiUrl("/auth/age-gate"), {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dob }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setAgeStatus(
          result?.error === "age_restricted"
            ? "This feature is not available for players under 13."
            : "We could not check that date. Try again.",
          "error",
        );
        return;
      }

      waitingForAgeGateSession = true;
      setAgeStatus("Loading your player profile…", "pending");
      worldSocket.reconnect();
    } catch {
      setAgeStatus("We could not check that date. Try again.", "error");
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    const nextUsername = elements.settingsUsernameInput?.value
      .trim()
      .replace(/\s+/g, " ") ?? "";
    if (
      nextUsername.length < 2
      || nextUsername.length > USERNAME_MAX_LENGTH
      || !/^[A-Za-z0-9 _-]+$/.test(nextUsername)
    ) {
      setStatus(`Use 2–${USERNAME_MAX_LENGTH} letters, numbers, spaces, _ or -.`, "error");
      return;
    }
    setStatus("Checking that name…", "pending");
    worldSocket.setUsername(nextUsername);
  }

  function handleUsernameResult(event) {
    if (event.type === "username_updated") {
      activeUsername = event.username;
      engine.setUsername(activeUsername);
      setOpen(false);
      return;
    }
    if (event.type === "username_error") {
      if (event.code === "age_required") {
        setAgeStatus("Complete the age check before choosing a name.", "error");
        setMode("age");
        return;
      }
      setStatus(event.code === "username_taken"
        ? "That name is already in use. Try another."
        : "That name could not be saved. Try again.", "error");
    }
  }

  const listeners = [
    [elements.settingsAgeForm, "submit", handleAgeSubmit],
    [elements.settingsUsernameForm, "submit", handleSubmit],
    [elements.settingsCancelButton, "click", () => setOpen(false)],
    [elements.settingsCancelButtonSecondary, "click", () => setOpen(false)],
    [elements.settingsAgeCancelButton, "click", () => setOpen(false)],
  ];
  listeners.forEach(([target, type, handler]) => target?.addEventListener(type, handler));

  worldSocket.onUsernameResult = handleUsernameResult;
  worldSocket.onSession = (nextSession) => {
    session = nextSession;
    activeUsername = nextSession.hasUsername ? nextSession.username : "";
    engine.setUsername(nextSession.username);
    if (waitingForAgeGateSession && nextSession.authenticated) {
      waitingForAgeGateSession = false;
      elements.settingsUsernameInput.value = activeUsername;
      setStatus("Choose a unique name using 2–24 letters, numbers, spaces, _ or -.");
      setMode("username");
    }
  };

  return {
    interact,
    update(frame, worldId) {
      roomState = worldId === "settings" ? (frame.settingsRoomState ?? 0) : 0;
      if (roomState === 0 && isOpen) setOpen(false);
    },
    destroy() {
      listeners.forEach(([target, type, handler]) => target?.removeEventListener(type, handler));
      if (worldSocket.onUsernameResult === handleUsernameResult) {
        worldSocket.onUsernameResult = null;
      }
      worldSocket.onSession = null;
      setOpen(false);
    },
  };
}
