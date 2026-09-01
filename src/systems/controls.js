import { zoomConfig } from "../config/gameConfig.js";

const movementCodes = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowLeft",
  "ArrowDown",
  "ArrowRight",
  "ShiftLeft",
  "ShiftRight",
  "Space",
]);

function isInteractiveTarget(target) {
  return target instanceof Element && Boolean(
    target.closest("button, a, input, textarea, select, [contenteditable='true']"),
  );
}

export function bindControls({
  elements,
  state,
  onDismissHint,
  onResetView,
  onLook,
  onZoom,
  onJump,
}) {
  const {
    canvas,
    joystickElement,
    joystickKnob,
    runToggle,
    jumpButton,
    resetButton,
    zoomOutButton,
    zoomInButton,
  } = elements;

  function adjustZoom(amount) {
    onZoom?.(amount);
    onDismissHint();
  }

  function setViewFromInput(horizontal, vertical = 0) {
    onLook?.(horizontal, vertical);
  }

  function queueJump() {
    state.movement.jumpQueued = true;
    onJump?.();
    onDismissHint();
  }

  function stopPointerLook(event) {
    if (
      !state.pointer.active ||
      (event && event.pointerId !== state.pointer.id)
    ) return;
    state.pointer.active = false;
    state.pointer.id = null;
    canvas.classList.remove("is-looking");
  }

  function handlePointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    state.pointer.active = true;
    state.pointer.id = event.pointerId;
    state.pointer.x = event.clientX;
    state.pointer.y = event.clientY;
    canvas.focus({ preventScroll: true });
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add("is-looking");
    onDismissHint();
  }

  function handlePointerMove(event) {
    if (!state.pointer.active || event.pointerId !== state.pointer.id) return;

    const deltaX = event.clientX - state.pointer.x;
    const deltaY = event.clientY - state.pointer.y;
    state.pointer.x = event.clientX;
    state.pointer.y = event.clientY;
    setViewFromInput(deltaX, deltaY);
  }

  function handleKeyDown(event) {
    if (isInteractiveTarget(event.target)) return;

    if (event.code === "KeyO" || event.code === "KeyI") {
      event.preventDefault();
      if (!event.repeat) {
        adjustZoom(event.code === "KeyO" ? zoomConfig.step : -zoomConfig.step);
      }
      return;
    }

    if (!movementCodes.has(event.code)) return;

    state.keys.add(event.code);
    event.preventDefault();
    onDismissHint();

    if (event.code === "Space" && !event.repeat) queueJump();
  }

  function resetJoystick() {
    state.joystickPointer.active = false;
    state.joystickPointer.id = null;
    state.movement.joystickX = 0;
    state.movement.joystickY = 0;
    if (joystickKnob) {
      joystickKnob.style.transform = "translate(-50%, -50%) translate(0, 0)";
    }
  }

  function updateJoystick(event) {
    if (!(joystickElement instanceof HTMLElement)) return;

    const bounds = joystickElement.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    const maxDistance = Math.max(bounds.width / 2 - 22, 20);
    const deltaX = event.clientX - centerX;
    const deltaY = event.clientY - centerY;
    const distance = Math.hypot(deltaX, deltaY);
    const limitedDistance = Math.min(distance, maxDistance);
    const angle = distance === 0 ? 0 : Math.atan2(deltaY, deltaX);
    const knobX = Math.cos(angle) * limitedDistance;
    const knobY = Math.sin(angle) * limitedDistance;

    state.movement.joystickX = knobX / maxDistance;
    state.movement.joystickY = knobY / maxDistance;
    if (joystickKnob) {
      joystickKnob.style.transform =
        `translate(-50%, -50%) translate(${knobX}px, ${knobY}px)`;
    }
    onDismissHint();
  }

  function handleRunToggle() {
    state.movement.mobileSprint = !state.movement.mobileSprint;
    runToggle.setAttribute("aria-pressed", String(state.movement.mobileSprint));
    runToggle.classList.toggle("is-active", state.movement.mobileSprint);
  }

  canvas.addEventListener("pointerdown", handlePointerDown);
  canvas.addEventListener("pointermove", handlePointerMove);
  canvas.addEventListener("pointerup", stopPointerLook);
  canvas.addEventListener("pointercancel", stopPointerLook);
  canvas.addEventListener("lostpointercapture", stopPointerLook);
  canvas.addEventListener("wheel", (event) => {
    if (
      Math.abs(event.deltaY) >= Math.abs(event.deltaX) &&
      Math.abs(event.deltaY) > 0.5
    ) {
      event.preventDefault();
      adjustZoom(Math.sign(event.deltaY) * 0.9);
      return;
    }

    if (Math.abs(event.deltaX) > 0.5) {
      event.preventDefault();
      setViewFromInput(event.deltaX * 0.6);
      onDismissHint();
    }
  }, { passive: false });

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", (event) => state.keys.delete(event.code));
  window.addEventListener("blur", () => {
    state.keys.clear();
    state.movement.jumpQueued = false;
    resetJoystick();
  });

  joystickElement?.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    state.joystickPointer.active = true;
    state.joystickPointer.id = event.pointerId;
    joystickElement.setPointerCapture(event.pointerId);
    updateJoystick(event);
  });
  joystickElement?.addEventListener("pointermove", (event) => {
    if (
      !state.joystickPointer.active ||
      event.pointerId !== state.joystickPointer.id
    ) return;
    event.preventDefault();
    updateJoystick(event);
  });
  joystickElement?.addEventListener("pointerup", resetJoystick);
  joystickElement?.addEventListener("pointercancel", resetJoystick);
  joystickElement?.addEventListener("lostpointercapture", resetJoystick);

  runToggle?.addEventListener("click", handleRunToggle);
  jumpButton?.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    queueJump();
  });
  jumpButton?.addEventListener("click", queueJump);
  resetButton?.addEventListener("click", () => {
    onResetView();
    canvas.focus({ preventScroll: true });
  });
  zoomOutButton?.addEventListener("click", () => adjustZoom(zoomConfig.step));
  zoomInButton?.addEventListener("click", () => adjustZoom(-zoomConfig.step));

  return { resetJoystick };
}
