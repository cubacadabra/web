import * as THREE from "three";

const canvas = document.querySelector("#world-canvas");
const worldShell = document.querySelector("#world-shell");
const lookHint = document.querySelector("#look-hint");
const loadingState = document.querySelector("#loading-state");
const resetButton = document.querySelector("#reset-view");
const headingValue = document.querySelector("#heading-value");
const compassNeedle = document.querySelector("#compass-needle");

if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("The world canvas could not be found.");
}

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  canvas,
  powerPreference: "high-performance",
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xc9d9d0, 38, 118);

const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 220);
camera.position.set(0, 3.4, 11.5);

const ambientLight = new THREE.HemisphereLight(0xdff0f0, 0x6c866e, 2.25);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xfff2d6, 3.25);
sunLight.position.set(-24, 30, 18);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1024, 1024);
sunLight.shadow.camera.near = 1;
sunLight.shadow.camera.far = 100;
sunLight.shadow.camera.left = -42;
sunLight.shadow.camera.right = 42;
sunLight.shadow.camera.top = 42;
sunLight.shadow.camera.bottom = -42;
sunLight.shadow.bias = -0.0008;
scene.add(sunLight);

const world = new THREE.Group();
scene.add(world);

const colors = {
  ground: 0x8caf83,
  groundEdge: 0x5f806d,
  grid: 0x71977e,
  coral: 0xed725b,
  butter: 0xf2c764,
  periwinkle: 0x7898dc,
  ink: 0x264b4b,
  paper: 0xf6f1e7,
};

function createBlock(position, size, color, options = {}) {
  const geometry = new THREE.BoxGeometry(...size);
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.86,
    metalness: 0,
  });
  const block = new THREE.Mesh(geometry, material);
  block.position.set(...position);
  block.castShadow = true;
  block.receiveShadow = true;
  world.add(block);

  if (options.outline !== false) {
    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({
        color: colors.paper,
        transparent: true,
        opacity: 0.22,
      }),
    );
    block.add(outline);
  }

  return block;
}

function createSpawnPad() {
  const pad = new THREE.Group();
  pad.position.set(0, 0, 6.25);

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(2.45, 2.45, 0.18, 32),
    new THREE.MeshStandardMaterial({
      color: colors.ink,
      roughness: 0.92,
    }),
  );
  base.position.y = 0.11;
  base.castShadow = true;
  base.receiveShadow = true;
  pad.add(base);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.78, 0.055, 8, 32),
    new THREE.MeshBasicMaterial({
      color: colors.paper,
      transparent: true,
      opacity: 0.52,
    }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.23;
  pad.add(ring);

  const center = new THREE.Mesh(
    new THREE.CircleGeometry(1.35, 32),
    new THREE.MeshBasicMaterial({
      color: colors.ink,
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide,
    }),
  );
  center.rotation.x = -Math.PI / 2;
  center.position.y = 0.205;
  pad.add(center);

  world.add(pad);
  return pad;
}

function createCloud(position, scale) {
  const cloud = new THREE.Group();
  cloud.position.set(...position);
  cloud.scale.setScalar(scale);

  const cloudMaterial = new THREE.MeshBasicMaterial({
    color: colors.paper,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
  });

  [
    [-1.1, 0, 0, 1.1],
    [0, 0.24, 0, 1.45],
    [1.1, 0.02, 0, 0.92],
    [0.42, -0.15, 0.08, 1.05],
  ].forEach(([x, y, z, radius]) => {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 12, 8),
      cloudMaterial,
    );
    puff.position.set(x, y, z);
    cloud.add(puff);
  });

  scene.add(cloud);
  return cloud;
}

const ground = new THREE.Mesh(
  new THREE.BoxGeometry(120, 0.7, 120),
  new THREE.MeshStandardMaterial({
    color: colors.ground,
    roughness: 1,
    metalness: 0,
  }),
);
ground.position.y = -0.35;
ground.receiveShadow = true;
world.add(ground);

const groundEdge = new THREE.LineSegments(
  new THREE.EdgesGeometry(ground.geometry),
  new THREE.LineBasicMaterial({
    color: colors.groundEdge,
    transparent: true,
    opacity: 0.28,
  }),
);
groundEdge.position.copy(ground.position);
world.add(groundEdge);

const grid = new THREE.GridHelper(112, 28, colors.grid, colors.grid);
grid.position.y = 0.012;
grid.material.transparent = true;
grid.material.opacity = 0.22;
grid.material.depthWrite = false;
world.add(grid);

const spawnPad = createSpawnPad();
const coralBlock = createBlock([0.15, 1.35, -13.5], [2.8, 2.7, 2.8], colors.coral);
const butterBlock = createBlock([-8.1, 0.8, -22], [3.8, 1.6, 3.8], colors.butter);
const blueBlock = createBlock([8.4, 1.5, -27], [2.2, 3, 2.2], colors.periwinkle);
const tinyBlock = createBlock([13, 0.5, -17], [1, 1, 1], colors.ink, {
  outline: false,
});

// A handful of soft horizon markers keep the world readable while it stays sparse.
createBlock([-22, 0.35, -34], [1.2, 0.7, 1.2], colors.coral, {
  outline: false,
});
createBlock([24, 0.5, -39], [1.5, 1, 1.5], colors.butter, {
  outline: false,
});
createBlock([-28, 0.5, 18], [1.5, 1, 1.5], colors.periwinkle, {
  outline: false,
});

const cloudA = createCloud([-18, 18, -55], 1.35);
const cloudB = createCloud([24, 22, -72], 1.8);
const cloudC = createCloud([42, 15, 12], 0.95);

const initialView = {
  yaw: 0,
  pitch: -0.095,
};

const view = {
  yaw: initialView.yaw,
  pitch: initialView.pitch,
  targetYaw: initialView.yaw,
  targetPitch: initialView.pitch,
};

const pointer = {
  active: false,
  id: null,
  x: 0,
  y: 0,
};

const maxPitch = 1.1;
const lookSensitivity = 0.0062;
const keyboardSensitivity = 0.055;
let hintDismissed = false;
let elapsed = 0;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function damp(current, target, smoothing, delta) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-smoothing * delta));
}

function dismissHint() {
  if (hintDismissed) return;
  hintDismissed = true;
  lookHint?.classList.add("is-hidden");
}

function setViewFromInput(horizontal, vertical = 0) {
  view.targetYaw -= horizontal * lookSensitivity;
  view.targetPitch = clamp(
    view.targetPitch + vertical * lookSensitivity,
    -maxPitch,
    maxPitch,
  );
}

function stopPointerLook(event) {
  if (!pointer.active || (event && event.pointerId !== pointer.id)) return;
  pointer.active = false;
  pointer.id = null;
  canvas.classList.remove("is-looking");
}

canvas.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "mouse" && event.button !== 0) return;

  pointer.active = true;
  pointer.id = event.pointerId;
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  canvas.focus({ preventScroll: true });
  canvas.setPointerCapture(event.pointerId);
  canvas.classList.add("is-looking");
  dismissHint();
});

canvas.addEventListener("pointermove", (event) => {
  if (!pointer.active || event.pointerId !== pointer.id) return;

  const deltaX = event.clientX - pointer.x;
  const deltaY = event.clientY - pointer.y;
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  setViewFromInput(deltaX, deltaY);
});

canvas.addEventListener("pointerup", stopPointerLook);
canvas.addEventListener("pointercancel", stopPointerLook);
canvas.addEventListener("lostpointercapture", () => stopPointerLook());

canvas.addEventListener("keydown", (event) => {
  const amount = event.shiftKey ? keyboardSensitivity * 1.8 : keyboardSensitivity;
  let handled = true;

  switch (event.key) {
    case "ArrowLeft":
      view.targetYaw += amount;
      break;
    case "ArrowRight":
      view.targetYaw -= amount;
      break;
    case "ArrowUp":
      view.targetPitch = clamp(view.targetPitch - amount, -maxPitch, maxPitch);
      break;
    case "ArrowDown":
      view.targetPitch = clamp(view.targetPitch + amount, -maxPitch, maxPitch);
      break;
    default:
      handled = false;
  }

  if (handled) {
    event.preventDefault();
    dismissHint();
  }
});

canvas.addEventListener("wheel", (event) => {
  if (Math.abs(event.deltaX) < 0.5) return;
  event.preventDefault();
  setViewFromInput(event.deltaX * 0.6);
  dismissHint();
}, { passive: false });

resetButton?.addEventListener("click", () => {
  view.yaw = initialView.yaw;
  view.pitch = initialView.pitch;
  view.targetYaw = initialView.yaw;
  view.targetPitch = initialView.pitch;
  canvas.focus({ preventScroll: true });
});

function getHeading() {
  const fullTurn = Math.PI * 2;
  const wrappedYaw = ((-view.yaw % fullTurn) + fullTurn) % fullTurn;
  return Math.round(THREE.MathUtils.radToDeg(wrappedYaw)) % 360;
}

function getCardinalDirection(degrees) {
  if (degrees >= 315 || degrees < 45) return "N";
  if (degrees < 135) return "E";
  if (degrees < 225) return "S";
  return "W";
}

function updateCompass() {
  const heading = getHeading();
  const cardinal = getCardinalDirection(heading);
  if (headingValue) headingValue.textContent = `${cardinal} ${heading}°`;
  if (compassNeedle) {
    compassNeedle.style.transform =
      `translate(-50%, -50%) rotate(${heading}deg)`;
  }
}

function resizeRenderer() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return;

  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.fov = width < 700 ? 64 : 58;
  camera.updateProjectionMatrix();
}

const resizeObserver = new ResizeObserver(resizeRenderer);
resizeObserver.observe(canvas);
resizeRenderer();

function render(delta) {
  elapsed += Math.min(delta, 0.05);

  view.yaw = damp(view.yaw, view.targetYaw, 10, delta);
  view.pitch = damp(view.pitch, view.targetPitch, 10, delta);

  camera.rotation.order = "YXZ";
  camera.rotation.y = view.yaw;
  camera.rotation.x = view.pitch;
  camera.rotation.z = 0;
  camera.position.y = 3.4 + Math.sin(elapsed * 0.7) * 0.018;

  spawnPad.rotation.y = Math.sin(elapsed * 0.22) * 0.015;
  coralBlock.rotation.y = Math.sin(elapsed * 0.16) * 0.008;
  butterBlock.rotation.y = Math.sin(elapsed * 0.13 + 1) * 0.006;
  blueBlock.rotation.y = Math.sin(elapsed * 0.18 + 2) * 0.008;
  cloudA.position.x = -18 + Math.sin(elapsed * 0.025) * 1.2;
  cloudB.position.x = 24 + Math.sin(elapsed * 0.02 + 1) * 1.6;
  cloudC.position.x = 42 + Math.sin(elapsed * 0.018 + 2) * 1.4;

  updateCompass();
  renderer.render(scene, camera);
}

const clock = new THREE.Clock();
function animate() {
  render(clock.getDelta());
  requestAnimationFrame(animate);
}

worldShell?.classList.add("is-ready");
loadingState?.classList.add("is-ready");
animate();
