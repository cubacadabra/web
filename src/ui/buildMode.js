const COLOR_VALUES = {
  coral: 0xed725b,
  butter: 0xf2c764,
  periwinkle: 0x7898dc,
  ink: 0x264b4b,
  paper: 0xf6f1e7,
};

const COLORS = Object.keys(COLOR_VALUES);
const SHAPES = [
  { id: "cube", size: [1, 1, 1] },
  { id: "beam", size: [3, 1, 1] },
  { id: "slab", size: [2, 0.5, 2] },
];
const TOOLS = ["place", "rotate", "remove", "recolor"];

export function createBuildModeController({ state, worldSocket, engine, onReturn }) {
  let phase = "build";
  let blocks = [];
  let tool = "place";
  let shapeIndex = 0;
  let colorIndex = 0;

  function shape() {
    return SHAPES[shapeIndex];
  }

  function color() {
    return COLORS[colorIndex];
  }

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

  function targetForFrame(frame) {
    const yaw = frame.camera.yaw;
    const selectedShape = shape();
    const distance = 4;
    return {
      x: Math.round((frame.player.position.x + Math.sin(yaw) * distance) * 2) / 2,
      y: selectedShape.size[1] / 2,
      z: Math.round((frame.player.position.z - Math.cos(yaw) * distance) * 2) / 2,
      rotation: 0,
      shape: selectedShape.id,
      color: color(),
    };
  }

  function nearestBlock(frame) {
    const target = targetForFrame(frame);
    let best = null;
    let bestDistance = 2.1;
    blocks.forEach((block) => {
      const distance = Math.hypot(
        block.x - target.x,
        block.z - target.z,
        (block.y || 0) - target.y,
      );
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
      worldSocket.sendExperience("build_action", {
        action: "place",
        block: targetForFrame(frame),
      });
      return;
    }
    const block = nearestBlock(frame);
    if (!block) return;
    worldSocket.sendExperience("build_action", {
      action: tool,
      id: block.id,
      color: tool === "recolor" ? color() : undefined,
    });
  }

  function cycleBuildShape() {
    shapeIndex = (shapeIndex + 1) % SHAPES.length;
  }

  function cycleBuildColor() {
    colorIndex = (colorIndex + 1) % COLORS.length;
  }

  function handleUiEvent(event) {
    if (event.phase !== "activate") return true;
    if (event.action === "build.tool") {
      tool = TOOLS[(TOOLS.indexOf(tool) + 1) % TOOLS.length];
    } else if (event.action === "build.shape") {
      cycleBuildShape();
    } else if (event.action === "build.color") {
      cycleBuildColor();
    } else if (event.action === "build.use") {
      act(state.runtime.engineFrame);
    } else if (event.action === "build.save") {
      worldSocket.sendExperience("build_save");
    } else if (event.action === "build.return") {
      onReturn();
    } else if (event.action.startsWith("build.shape.")) {
      const nextIndex = SHAPES.findIndex((item) => item.id === event.action.slice(12));
      if (nextIndex >= 0) shapeIndex = nextIndex;
    } else if (event.action.startsWith("build.color.")) {
      const nextIndex = COLORS.indexOf(event.action.slice(12));
      if (nextIndex >= 0) colorIndex = nextIndex;
    }
    return true;
  }

  function handleState(event) {
    if (event.kind !== "build") return;
    phase = event.phase || "build";
    blocks = Array.isArray(event.blocks) ? event.blocks : [];
    syncBlocks();
  }

  return {
    handleState,
    handleUiEvent,
    handleKeyboard(event) {
      if (state.runtime.worldId !== "real-game" || state.runtime.settingsOpen) return;
      if (event.code === "KeyB") tool = "place";
      if (event.code === "KeyR") tool = "rotate";
      if (event.code === "KeyX") tool = "remove";
      if (event.code === "KeyC") tool = "recolor";
      if (event.code === "Enter") act(state.runtime.engineFrame);
    },
    update(frame) {
      state.runtime.engineFrame = frame;
    },
    destroy() {},
  };
}
