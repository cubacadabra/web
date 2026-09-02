const USERNAME_MAX_LENGTH = 24;

export function createSettingsRoomController({ elements, state, worldSocket }) {
  let isOpen = false;
  let isDismissedUntilExit = false;
  let activeUsername = worldSocket.username;

  function setPanelOpen(nextOpen) {
    isOpen = nextOpen;
    state.runtime.settingsOpen = nextOpen;
    if (!elements.settingsRoomPanel) return;

    elements.settingsRoomPanel.hidden = !nextOpen;
    elements.settingsRoomPanel.setAttribute("aria-hidden", String(!nextOpen));
    if (nextOpen) {
      elements.settingsUsernameOption?.focus({ preventScroll: true });
    }
  }

  function setStatus(message, type = "") {
    if (!elements.settingsUsernameStatus) return;
    elements.settingsUsernameStatus.textContent = message;
    elements.settingsUsernameStatus.dataset.state = type;
  }

  function renderUsername() {
    if (elements.settingsUsernameValue) {
      elements.settingsUsernameValue.textContent = activeUsername;
    }
    if (elements.settingsUsernameInput && document.activeElement !== elements.settingsUsernameInput) {
      elements.settingsUsernameInput.value = activeUsername;
    }
  }

  function openRoom() {
    if (isOpen || isDismissedUntilExit) return;
    renderUsername();
    setStatus("Choose a name other players can find you by.");
    setPanelOpen(true);
  }

  function leaveRoom() {
    isDismissedUntilExit = true;
    setPanelOpen(false);
    elements.settingsUsernameOption?.classList.remove("is-selected");
    elements.settingsUsernameForm?.setAttribute("hidden", "");
  }

  function selectUsername() {
    if (!isOpen) return;
    elements.settingsUsernameOption?.classList.add("is-selected");
    if (elements.settingsUsernameForm) elements.settingsUsernameForm.hidden = false;
    renderUsername();
    elements.settingsUsernameInput?.focus({ preventScroll: true });
    elements.settingsUsernameInput?.select();
  }

  function handleSubmit(event) {
    event.preventDefault();
    const nextUsername = elements.settingsUsernameInput?.value.trim() ?? "";
    if (nextUsername.length < 2 || nextUsername.length > USERNAME_MAX_LENGTH) {
      setStatus(`Use 2–${USERNAME_MAX_LENGTH} characters.`, "error");
      return;
    }

    setStatus("Checking that name…", "pending");
    worldSocket.setUsername(nextUsername);
  }

  function handleUsernameResult(event) {
    if (event.type === "username_updated") {
      activeUsername = event.username;
      renderUsername();
      setStatus("Saved. Your new name is live in this lobby.", "success");
      return;
    }
    if (event.type === "username_error") {
      setStatus(event.code === "username_taken"
        ? "That name is already in use. Try another."
        : "That name could not be saved. Try again.", "error");
    }
  }

  function update(frame, worldId) {
    if (worldId !== "lobby" || !frame?.player?.position) {
      if (isOpen) setPanelOpen(false);
      return;
    }

    const roomState = frame.settingsRoomState ?? 0;
    const inside = roomState === 2;
    if (!inside) isDismissedUntilExit = false;

    if (elements.settingsRoomHint) {
      elements.settingsRoomHint.hidden = isOpen || roomState !== 1;
    }
    if (inside) openRoom();
  }

  const listeners = [
    [elements.settingsUsernameOption, "click", selectUsername],
    [elements.settingsUsernameForm, "submit", handleSubmit],
    [elements.settingsLeaveButton, "click", leaveRoom],
  ];
  listeners.forEach(([target, type, handler]) => target?.addEventListener(type, handler));

  worldSocket.onUsernameResult = handleUsernameResult;
  renderUsername();

  return {
    update,
    destroy() {
      listeners.forEach(([target, type, handler]) => target?.removeEventListener(type, handler));
      if (worldSocket.onUsernameResult === handleUsernameResult) {
        worldSocket.onUsernameResult = null;
      }
      setPanelOpen(false);
    },
  };
}
