const RENDERER_MODULE_PATH = "wasm/renderer/cubacadabra_renderer.js";

const PLAYER_COLORS = {
  skin: 0xe8ae86,
  shirt: 0x2d6663,
  pants: 0x536a90,
  shoes: 0x293a43,
};

const NPC_PALETTES = [
  { shirt: 0xe76f51, pants: 0x355070, skin: 0xf0b18a },
  { shirt: 0x5f8f78, pants: 0x3e5974, skin: 0xd99770 },
  { shirt: 0x748bd2, pants: 0x43515e, skin: 0xf4c39f },
  { shirt: 0xf0b54d, pants: 0x385c62, skin: 0xc98263 },
  { shirt: 0xb276a9, pants: 0x4b5e80, skin: 0xe4a77b },
  { shirt: 0x3f8884, pants: 0x414b5b, skin: 0xf1c29b },
];

function rgba(value, fallback = 0xffffff) {
  const color = typeof value === "number" ? value : fallback;
  return [
    ((color >> 16) & 0xff) / 255,
    ((color >> 8) & 0xff) / 255,
    (color & 0xff) / 255,
    1,
  ];
}

function flattenBlocks(world) {
  return new Float32Array((world.blocks ?? []).flatMap((block) => [
    ...(block.position ?? [0, 0, 0]),
    ...(block.size ?? [1, 1, 1]),
    ...rgba(block.color),
  ]));
}

function flattenPads(world, frame) {
  return new Float32Array((world.launchPads ?? []).flatMap((pad, index) => {
    const livePad = frame.launchPads[index];
    return [
      pad.position?.[0] ?? 0,
      pad.position?.[2] ?? pad.position?.[1] ?? 0,
      pad.radius ?? 1,
      livePad?.seconds ?? 0,
      ...rgba(pad.color),
    ];
  }));
}

function flattenAgent(agent, colors, assembled = false) {
  return [
    agent.position.x,
    agent.position.y,
    agent.position.z,
    agent.yaw,
    agent.walkCycle,
    assembled ? 1 : 0,
    ...rgba(colors.skin),
    ...rgba(colors.shirt),
    ...rgba(colors.pants),
    ...rgba(colors.shoes ?? PLAYER_COLORS.shoes),
  ];
}

function flattenAgents(frame) {
  return new Float32Array(frame.agents.flatMap((agent, index) => {
    const palette = NPC_PALETTES[index % NPC_PALETTES.length];
    return flattenAgent(agent, palette, agent.assembled);
  }));
}

function flattenPalette(world) {
  const palette = world.palette ?? {};
  return new Float32Array([
    ...rgba(palette.sky, 0x9ab9be),
    ...rgba(palette.ground, 0xa7bd99),
    ...rgba(palette.groundEdge, 0x587276),
    ...rgba(palette.grid, 0xc4d5cf),
    ...rgba(palette.ink, 0x173f43),
  ]);
}

export async function createRustRenderer({ canvas }) {
  const moduleUrl = new URL(RENDERER_MODULE_PATH, document.baseURI);
  const bindings = await import(moduleUrl.href);
  await bindings.default();

  const pixelSize = () => {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    return {
      width: Math.max(1, Math.round(canvas.clientWidth * pixelRatio)),
      height: Math.max(1, Math.round(canvas.clientHeight * pixelRatio)),
    };
  };

  let size = pixelSize();
  const renderer = await bindings.WebRenderer.create(canvas, size.width, size.height);

  return {
    resize() {
      size = pixelSize();
      renderer.resize(size.width, size.height);
    },
    render(world, frame) {
      renderer.set_scene(
        flattenBlocks(world),
        flattenPads(world, frame),
        flattenAgents(frame),
        new Float32Array(flattenAgent(frame.player, PLAYER_COLORS)),
        flattenPalette(world),
        world.world?.groundSize ?? 72,
        new Float32Array([
          frame.camera.yaw,
          frame.camera.pitch,
          frame.camera.distance,
        ]),
        frame.elapsed,
      );
      renderer.draw();
    },
  };
}
