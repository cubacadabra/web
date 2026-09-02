const USERNAME_MAX_LENGTH = 24;

export function createSettingsRoomController({ elements, state, worldSocket, engine }) {
  let isOpen = false;
  let roomState = 0;
  let activeUsername = worldSocket.username;

  function setOpen(nextOpen) {
    isOpen = nextOpen;
    state.runtime.settingsOpen = nextOpen;
    if (!elements.settingsRoomPanel) return;
    elements.settingsRoomPanel.hidden = !nextOpen;
    elements.settingsRoomPanel.setAttribute("aria-hidden", String(!nextOpen));
    if (nextOpen) {
      elements.settingsUsernameInput.value = activeUsername;
      elements.settingsUsernameInput.focus({ preventScroll: true });
      elements.settingsUsernameInput.select();
    } else {
      elements.canvas.focus({ preventScroll: true });
    }
  }

  function setStatus(message, type = "") {
    if (!elements.settingsUsernameStatus) return;
    elements.settingsUsernameStatus.textContent = message;
    elements.settingsUsernameStatus.dataset.state = type;
  }

  function interact() {
    if (roomState !== 2 || isOpen) return false;
    setStatus("Choose a unique name using 2–24 letters, numbers, spaces, _ or -.");
    setOpen(true);
    return true;
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
      setStatus(event.code === "username_taken"
        ? "That name is already in use. Try another."
        : "That name could not be saved. Try again.", "error");
    }
  }

  const listeners = [
    [elements.settingsUsernameForm, "submit", handleSubmit],
    [elements.settingsCancelButton, "click", () => setOpen(false)],
    [elements.settingsCancelButtonSecondary, "click", () => setOpen(false)],
  ];
  listeners.forEach(([target, type, handler]) => target?.addEventListener(type, handler));

  worldSocket.onUsernameResult = handleUsernameResult;
  engine.setUsername(activeUsername);

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
      setOpen(false);
    },
  };
}
