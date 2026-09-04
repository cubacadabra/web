import { zoomConfig } from "../config/clientConfig.js";

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
  onInteract,
  onUiPointer,
  onUiHitTest,
  onBuildKeyboard,
}) {
  const { canvas } = elements;
  const removeListeners = [];
  const uiPointers = new Set();
  const cameraPointers = new Map();
  let pinchDistance = null;

  function listen(target, type, handler, options) {
    if (!target) return;
    target.addEventListener(type, handler, options);
    removeListeners.push(() => target.removeEventListener(type, handler, options));
  }

  function adjustZoom(amount) {
    onZoom?.(amount);
    onDismissHint();
  }

  function setViewFromInput(horizontal, vertical = 0) {
    onLook?.(horizontal, vertical);
  }

  function pointInCanvas(event) {
    const bounds = canvas.getBoundingClientRect();
    return {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };
  }

  function sendUiPointer(event, phase) {
    const point = pointInCanvas(event);
    return onUiPointer?.(event.pointerId, phase, point.x, point.y) ?? false;
  }

  function updateCursor(event) {
    if (event.pointerType && event.pointerType !== "mouse") return;
    const point = pointInCanvas(event);
    const isInteractive = onUiHitTest?.(point.x, point.y) ?? false;
    canvas.classList.toggle("is-pointer", Boolean(isInteractive));
  }

  function stopCameraPointer(pointerId) {
    cameraPointers.delete(pointerId);
    if (state.pointer.id === pointerId && cameraPointers.size > 0) {
      const [nextId, nextPoint] = cameraPointers.entries().next().value;
      state.pointer.active = true;
      state.pointer.id = nextId;
      state.pointer.x = nextPoint.x;
      state.pointer.y = nextPoint.y;
      state.pointer.moved = true;
    } else if (state.pointer.id === pointerId) {
      state.pointer.active = false;
      state.pointer.id = null;
      canvas.classList.remove("is-looking");
    }
    if (cameraPointers.size < 2) pinchDistance = null;
  }

  function updatePinch() {
    if (cameraPointers.size < 2) {
      pinchDistance = null;
      return;
    }
    const points = [...cameraPointers.values()].slice(0, 2);
    const distance = Math.hypot(
      points[0].x - points[1].x,
      points[0].y - points[1].y,
    );
    if (pinchDistance !== null) onZoom?.(-(distance - pinchDistance) / 100 * 8);
    pinchDistance = distance;
  }

  function handlePointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    canvas.focus({ preventScroll: true });

    if (!state.runtime.settingsOpen && sendUiPointer(event, 0)) {
      uiPointers.add(event.pointerId);
      updateCursor(event);
      onDismissHint();
      return;
    }
    if (state.runtime.settingsOpen) return;

    cameraPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    updatePinch();
    if (cameraPointers.size === 1) {
      state.pointer.active = true;
      state.pointer.id = event.pointerId;
      state.pointer.x = event.clientX;
      state.pointer.y = event.clientY;
      state.pointer.startX = event.clientX;
      state.pointer.startY = event.clientY;
      state.pointer.moved = false;
    }
    canvas.classList.add("is-looking");
    canvas.classList.remove("is-pointer");
    onDismissHint();
  }

  function handlePointerMove(event) {
    if (uiPointers.has(event.pointerId)) {
      event.preventDefault();
      sendUiPointer(event, 1);
      updateCursor(event);
      return;
    }
    if (!cameraPointers.has(event.pointerId)) {
      updateCursor(event);
      return;
    }
    event.preventDefault();

    cameraPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (cameraPointers.size > 1) {
      updatePinch();
      return;
    }
    if (!state.pointer.active || event.pointerId !== state.pointer.id) return;

    const deltaX = event.clientX - state.pointer.x;
    const deltaY = event.clientY - state.pointer.y;
    if (Math.hypot(
      event.clientX - state.pointer.startX,
      event.clientY - state.pointer.startY,
    ) > 6) state.pointer.moved = true;
    state.pointer.x = event.clientX;
    state.pointer.y = event.clientY;
    setViewFromInput(deltaX, deltaY);
  }

  function handlePointerUp(event) {
    if (uiPointers.delete(event.pointerId)) {
      event.preventDefault();
      sendUiPointer(event, 2);
      stopCameraPointer(event.pointerId);
      updateCursor(event);
      return;
    }
    const shouldInteract = state.pointer.active
      && event.pointerId === state.pointer.id
      && !state.pointer.moved;
    stopCameraPointer(event.pointerId);
    updateCursor(event);
    if (shouldInteract) onInteract?.();
  }

  function handlePointerCancel(event) {
    if (uiPointers.delete(event.pointerId)) {
      sendUiPointer(event, 3);
      stopCameraPointer(event.pointerId);
      updateCursor(event);
      return;
    }
    stopCameraPointer(event.pointerId);
    updateCursor(event);
  }

  function handleKeyDown(event) {
    if (state.runtime.settingsOpen) return;
    if (isInteractiveTarget(event.target)) return;

    if (event.code === "KeyE") {
      event.preventDefault();
      if (!event.repeat) onInteract?.();
      return;
    }

    if (event.code === "KeyO" || event.code === "KeyI") {
      event.preventDefault();
      if (!event.repeat) {
        adjustZoom(event.code === "KeyO" ? zoomConfig.step : -zoomConfig.step);
      }
      return;
    }

    if (event.code === "KeyB" || event.code === "KeyR" || event.code === "KeyX"
      || event.code === "KeyC" || event.code === "Enter") {
      event.preventDefault();
      if (!event.repeat) onBuildKeyboard?.(event);
      return;
    }

    if (!movementCodes.has(event.code)) return;

    state.keys.add(event.code);
    event.preventDefault();
    onDismissHint();

    if (event.code === "Space" && !event.repeat) {
      state.movement.jumpQueued = true;
    }

  }

  function handleWheel(event) {
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
  }

  function handleKeyUp(event) {
    state.keys.delete(event.code);
  }

  function handleBlur() {
    state.keys.clear();
    state.movement.jumpQueued = false;
    state.movement.mobileSprint = false;
    [...uiPointers].forEach((pointerId) => {
      onUiPointer?.(pointerId, 3, 0, 0);
    });
    uiPointers.clear();
    [...cameraPointers.keys()].forEach(stopCameraPointer);
    canvas.classList.remove("is-pointer");
  }

  function handleReset() {
    onResetView?.();
    canvas.focus({ preventScroll: true });
  }

  listen(canvas, "pointerdown", handlePointerDown);
  listen(canvas, "pointermove", handlePointerMove);
  listen(canvas, "pointerenter", updateCursor);
  listen(canvas, "pointerleave", () => {
    if (!state.pointer.active && uiPointers.size === 0) {
      canvas.classList.remove("is-pointer");
    }
  });
  listen(canvas, "pointerup", handlePointerUp);
  listen(canvas, "pointercancel", handlePointerCancel);
  listen(canvas, "lostpointercapture", handlePointerCancel);
  listen(canvas, "wheel", handleWheel, { passive: false });

  listen(window, "keydown", handleKeyDown);
  listen(window, "keyup", handleKeyUp);
  listen(window, "blur", handleBlur);

  listen(elements.resetButton, "click", handleReset);

  return {
    destroy() {
      removeListeners.splice(0).forEach((remove) => remove());
      handleBlur();
      state.keys.clear();
    },
  };
}
