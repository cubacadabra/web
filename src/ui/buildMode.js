const COLOR_VALUES = {
  coral: 0xed725b,
  butter: 0xf2c764,
  periwinkle: 0x7898dc,
  ink: 0x264b4b,
  paper: 0xf6f1e7,
};

const COLORS = Object.keys(COLOR_VALUES);
const SHAPES = [
  { id: "cube", label: "Cube", size: [1, 1, 1] },
  { id: "beam", label: "Beam", size: [3, 1, 1] },
  { id: "slab", label: "Slab", size: [2, 0.5, 2] },
];

export function createBuildModeController({ elements, state, worldSocket, engine, onReturn }) {
  let phase = "build";
  let blocks = [];
  let prompt = "Waiting for your prompt…";
  let endsAt = 0;
  let clockOffset = 0;
  let tool = "place";
  let shapeIndex = 0;
  let colorIndex = 0;

  function setVisible(visible) {
    if (elements.buildPanel) elements.buildPanel.hidden = !visible;
  }

  function shape() { return SHAPES[shapeIndex]; }
  function color() { return COLORS[colorIndex]; }

  function syncBlocks() {
    engine.setBuildBlocks(blocks.map((block) => {
      const selectedShape = SHAPES.find((item) => item.id === block.shape) || SHAPES[0];
      return {
        x: block.x,
        y: block.y,
        z: block.z,
        width: selectedShape.size[0],
        height: selectedShape.size[1],
        depth: selectedShape.size[2],
        color: COLOR_VALUES[block.color] ?? COLOR_VALUES.coral,
        rotation: block.rotation ?? 0,
      };
    }));
  }

  function renderOptions() {
    if (elements.buildShapeButton) elements.buildShapeButton.textContent = shape().label;
    if (elements.buildColorButton) {
      elements.buildColorButton.innerHTML = `<span aria-hidden="true"></span>${color()}`;
      elements.buildColorButton.querySelector("span").style.backgroundColor = `#${COLOR_VALUES[color()].toString(16).padStart(6, "0")}`;
    }
  }

  function renderState() {
    const isTour = phase === "tour";
    setVisible(state.runtime.worldId === "real-game");
    if (!elements.buildPanel || elements.buildPanel.hidden) return;
    elements.buildPhaseLabel.textContent = isTour ? "TOUR MODE" : "BUILD ROUND";
    elements.buildPrompt.textContent = isTour ? "Walk through what you made together." : prompt;
    elements.buildSaveButton.hidden = isTour;
    elements.buildReturnButton.hidden = !isTour;
    elements.buildToolButtons.forEach((button) => {
      button.disabled = isTour;
      button.classList.toggle("is-active", button.dataset.buildTool === tool && !isTour);
    });
    if (isTour) {
      elements.buildRoundMeta.textContent = `${blocks.length} blocks saved`;
      elements.buildStatus.textContent = "The build is saved for this session. Take a look around.";
    }
    renderOptions();
  }

  function targetForFrame(frame) {
    const yaw = frame.camera.yaw;
    const distance = 4;
    const x = Math.round((frame.player.position.x + Math.sin(yaw) * distance) * 2) / 2;
    const z = Math.round((frame.player.position.z - Math.cos(yaw) * distance) * 2) / 2;
    const current = shape();
    return {
      x,
      y: current.size[1] / 2,
      z,
      rotation: 0,
      shape: current.id,
      color: color(),
    };
  }

  function nearestBlock(frame) {
    const target = targetForFrame(frame);
    let best = null;
    let bestDistance = 2.1;
    blocks.forEach((block) => {
      const distance = Math.hypot(block.x - target.x, block.z - target.z, (block.y || 0) - target.y);
      if (distance < bestDistance) {
        best = block;
        bestDistance = distance;
      }
    });
    return best;
  }

  function act(frame) {
    if (state.runtime.worldId !== "real-game" || phase !== "build" || !frame) return;
    if (tool === "place") {
      worldSocket.sendExperience("build_action", { action: "place", block: targetForFrame(frame) });
      elements.buildStatus.textContent = "Sending your block to the shared build…";
      return;
    }
    const block = nearestBlock(frame);
    if (!block) {
      elements.buildStatus.textContent = "Look toward a nearby block first.";
      return;
    }
    worldSocket.sendExperience("build_action", {
      action: tool,
      id: block.id,
      color: tool === "recolor" ? color() : undefined,
    });
  }

  function handleState(event) {
    if (event.kind !== "build") return;
    phase = event.phase || "build";
    blocks = Array.isArray(event.blocks) ? event.blocks : [];
    prompt = event.prompt || prompt;
    endsAt = Number.isFinite(event.endsAt) ? event.endsAt : 0;
    clockOffset = Date.now() - (Number.isFinite(event.serverNow) ? event.serverNow : Date.now());
    syncBlocks();
    renderState();
  }

  const listeners = [];
  elements.buildToolButtons.forEach((button) => {
    const handler = () => {
      tool = button.dataset.buildTool || "place";
      renderState();
    };
    button.addEventListener("click", handler);
    listeners.push([button, "click", handler]);
  });
  const shapeHandler = () => {
    shapeIndex = (shapeIndex + 1) % SHAPES.length;
    renderOptions();
  };
  elements.buildShapeButton?.addEventListener("click", shapeHandler);
  if (elements.buildShapeButton) listeners.push([elements.buildShapeButton, "click", shapeHandler]);
  const colorHandler = () => {
    colorIndex = (colorIndex + 1) % COLORS.length;
    renderOptions();
  };
  elements.buildColorButton?.addEventListener("click", colorHandler);
  if (elements.buildColorButton) listeners.push([elements.buildColorButton, "click", colorHandler]);
  const saveHandler = () => worldSocket.sendExperience("build_save");
  elements.buildSaveButton?.addEventListener("click", saveHandler);
  if (elements.buildSaveButton) listeners.push([elements.buildSaveButton, "click", saveHandler]);
  const returnHandler = () => onReturn();
  elements.buildReturnButton?.addEventListener("click", returnHandler);
  if (elements.buildReturnButton) listeners.push([elements.buildReturnButton, "click", returnHandler]);
  const keyHandler = (event) => {
    if (state.runtime.worldId !== "real-game" || state.runtime.settingsOpen) return;
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    if (event.code === "KeyB") { tool = "place"; renderState(); }
    if (event.code === "KeyR") { tool = "rotate"; renderState(); }
    if (event.code === "KeyX") { tool = "remove"; renderState(); }
    if (event.code === "KeyC") { tool = "recolor"; renderState(); }
    if (event.code === "Enter") act(state.runtime.engineFrame);
  };
  window.addEventListener("keydown", keyHandler);
  const canvasHandler = () => act(state.runtime.engineFrame);
  elements.canvas.addEventListener("click", canvasHandler);

  renderOptions();
  return {
    handleState,
    update(frame) {
      if (state.runtime.worldId !== "real-game") {
        setVisible(false);
        return;
      }
      renderState();
      if (!elements.buildPanel || elements.buildPanel.hidden) return;
      if (phase === "build" && endsAt) {
        const remaining = Math.max(0, endsAt - (Date.now() - clockOffset));
        const seconds = Math.ceil(remaining / 1000);
        elements.buildRoundMeta.textContent = `Build together · ${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
      }
      state.runtime.engineFrame = frame;
    },
    act,
    destroy() {
      listeners.forEach(([target, type, handler]) => target.removeEventListener(type, handler));
      window.removeEventListener("keydown", keyHandler);
      elements.canvas.removeEventListener("click", canvasHandler);
    },
  };
}
