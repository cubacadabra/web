import * as THREE from "three";

const canvas = document.querySelector("#world-canvas");
const worldShell = document.querySelector("#world-shell");
const lookHint = document.querySelector("#look-hint");
const loadingState = document.querySelector("#loading-state");
const resetButton = document.querySelector("#reset-view");
const headingValue = document.querySelector("#heading-value");
const compassNeedle = document.querySelector("#compass-needle");
const movementState = document.querySelector("#movement-state");
const joystickElement = document.querySelector("#joystick");
const joystickKnob = document.querySelector("#joystick-knob");
const runToggle = document.querySelector("#run-toggle");
const jumpButton = document.querySelector("#jump-button");

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

const obstacles = [];

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

  if (options.collidable !== false) {
    obstacles.push({
      minX: position[0] - size[0] / 2,
      maxX: position[0] + size[0] / 2,
      minZ: position[2] - size[2] / 2,
      maxZ: position[2] + size[2] / 2,
      bottom: position[1] - size[1] / 2,
      top: position[1] + size[1] / 2,
    });
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
createBlock([13, 0.5, -17], [1, 1, 1], colors.ink, {
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

const player = {
  position: new THREE.Vector3(0, 0, 11.5),
  velocity: new THREE.Vector3(),
  grounded: true,
};

const playerConfig = {
  eyeHeight: 3.4,
  bodyHeight: 3.15,
  radius: 0.52,
  walkSpeed: 6.4,
  runSpeed: 11.5,
  acceleration: 22,
  airAcceleration: 9,
  gravity: 28,
  jumpVelocity: 10.5,
  worldLimit: 57.5,
};

const pointer = {
  active: false,
  id: null,
  x: 0,
  y: 0,
};

const maxPitch = 1.1;
const lookSensitivity = 0.0062;
const keys = new Set();
const movement = {
  joystickX: 0,
  joystickY: 0,
  mobileSprint: false,
  jumpQueued: false,
};
const joystickPointer = {
  active: false,
  id: null,
};
const forwardVector = new THREE.Vector3();
const rightVector = new THREE.Vector3();
const moveDirection = new THREE.Vector3();
const nextPlayerPosition = new THREE.Vector3();
let hintDismissed = false;
let elapsed = 0;
let lastMovementLabel = "";

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

function queueJump() {
  if (player.grounded) movement.jumpQueued = true;
  dismissHint();
}

function isInteractiveTarget(target) {
  return target instanceof Element && Boolean(
    target.closest("button, a, input, textarea, select, [contenteditable='true']"),
  );
}

function isKeyDown(...codes) {
  return codes.some((code) => keys.has(code));
}

function getMovementAxes() {
  let forward = 0;
  let strafe = 0;

  if (isKeyDown("KeyW", "ArrowUp")) forward += 1;
  if (isKeyDown("KeyS", "ArrowDown")) forward -= 1;
  if (isKeyDown("KeyD", "ArrowRight")) strafe += 1;
  if (isKeyDown("KeyA", "ArrowLeft")) strafe -= 1;

  forward += -movement.joystickY;
  strafe += movement.joystickX;

  const inputLength = Math.hypot(forward, strafe);
  if (inputLength > 1) {
    forward /= inputLength;
    strafe /= inputLength;
  }

  return { forward, strafe };
}

function playerCanOccupy(candidate) {
  const feet = player.position.y;
  const head = feet + playerConfig.bodyHeight;

  for (const obstacle of obstacles) {
    if (feet >= obstacle.top - 0.05 || head <= obstacle.bottom + 0.05) {
      continue;
    }

    const closestX = clamp(candidate.x, obstacle.minX, obstacle.maxX);
    const closestZ = clamp(candidate.z, obstacle.minZ, obstacle.maxZ);
    const distanceX = candidate.x - closestX;
    const distanceZ = candidate.z - closestZ;

    if (
      distanceX * distanceX + distanceZ * distanceZ <
      playerConfig.radius * playerConfig.radius
    ) {
      return false;
    }
  }

  return true;
}

function movePlayerHorizontally(delta) {
  const limit = playerConfig.worldLimit - playerConfig.radius;

  nextPlayerPosition.copy(player.position);
  nextPlayerPosition.x = clamp(
    player.position.x + player.velocity.x * delta,
    -limit,
    limit,
  );
  if (playerCanOccupy(nextPlayerPosition)) {
    player.position.x = nextPlayerPosition.x;
  } else {
    player.velocity.x = 0;
  }

  nextPlayerPosition.copy(player.position);
  nextPlayerPosition.z = clamp(
    player.position.z + player.velocity.z * delta,
    -limit,
    limit,
  );
  if (playerCanOccupy(nextPlayerPosition)) {
    player.position.z = nextPlayerPosition.z;
  } else {
    player.velocity.z = 0;
  }

  if (Math.abs(player.position.x) >= limit && Math.abs(player.velocity.x) > 0) {
    player.velocity.x = 0;
  }
  if (Math.abs(player.position.z) >= limit && Math.abs(player.velocity.z) > 0) {
    player.velocity.z = 0;
  }
}

function updateMovementStatus(moving, sprinting) {
  const label = !player.grounded
    ? "Jumping"
    : sprinting
      ? "Running"
      : moving
        ? "Walking"
        : "Idle / ready";

  if (label !== lastMovementLabel) {
    lastMovementLabel = label;
    if (movementState) movementState.textContent = label;
  }

  worldShell?.classList.toggle("is-running", sprinting);
  worldShell?.classList.toggle("is-jumping", !player.grounded);
}

function updatePlayer(delta) {
  const axes = getMovementAxes();
  const inputLength = Math.hypot(axes.forward, axes.strafe);
  const moving = inputLength > 0.01;
  const sprinting = moving && (
    isKeyDown("ShiftLeft", "ShiftRight") || movement.mobileSprint
  );

  forwardVector.set(-Math.sin(view.yaw), 0, -Math.cos(view.yaw));
  rightVector.set(Math.cos(view.yaw), 0, -Math.sin(view.yaw));
  moveDirection.set(0, 0, 0);
  moveDirection.addScaledVector(forwardVector, axes.forward);
  moveDirection.addScaledVector(rightVector, axes.strafe);
  if (moveDirection.lengthSq() > 1) moveDirection.normalize();

  const speed = sprinting ? playerConfig.runSpeed : playerConfig.walkSpeed;
  const targetVelocityX = moveDirection.x * speed;
  const targetVelocityZ = moveDirection.z * speed;
  const acceleration = player.grounded
    ? playerConfig.acceleration
    : playerConfig.airAcceleration;
  const blend = 1 - Math.exp(-acceleration * delta);

  player.velocity.x = THREE.MathUtils.lerp(
    player.velocity.x,
    targetVelocityX,
    blend,
  );
  player.velocity.z = THREE.MathUtils.lerp(
    player.velocity.z,
    targetVelocityZ,
    blend,
  );

  if (movement.jumpQueued && player.grounded) {
    player.velocity.y = playerConfig.jumpVelocity;
    player.grounded = false;
  }
  movement.jumpQueued = false;

  player.velocity.y -= playerConfig.gravity * delta;
  player.position.y += player.velocity.y * delta;

  if (player.position.y <= 0) {
    player.position.y = 0;
    player.velocity.y = 0;
    player.grounded = true;
  }

  movePlayerHorizontally(delta);
  updateMovementStatus(moving, sprinting);

  return { moving, sprinting };
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

window.addEventListener("keydown", (event) => {
  if (isInteractiveTarget(event.target)) return;

  const movementKey = [
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
  ].includes(event.code);

  if (!movementKey) return;

  keys.add(event.code);
  event.preventDefault();
  dismissHint();

  if (event.code === "Space" && !event.repeat) queueJump();
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

window.addEventListener("blur", () => {
  keys.clear();
  movement.jumpQueued = false;
  resetJoystick();
});

function resetJoystick() {
  joystickPointer.active = false;
  joystickPointer.id = null;
  movement.joystickX = 0;
  movement.joystickY = 0;
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

  movement.joystickX = knobX / maxDistance;
  movement.joystickY = knobY / maxDistance;
  if (joystickKnob) {
    joystickKnob.style.transform =
      `translate(-50%, -50%) translate(${knobX}px, ${knobY}px)`;
  }
  dismissHint();
}

joystickElement?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  joystickPointer.active = true;
  joystickPointer.id = event.pointerId;
  joystickElement.setPointerCapture(event.pointerId);
  updateJoystick(event);
});

joystickElement?.addEventListener("pointermove", (event) => {
  if (!joystickPointer.active || event.pointerId !== joystickPointer.id) return;
  event.preventDefault();
  updateJoystick(event);
});

joystickElement?.addEventListener("pointerup", resetJoystick);
joystickElement?.addEventListener("pointercancel", resetJoystick);
joystickElement?.addEventListener("lostpointercapture", resetJoystick);

runToggle?.addEventListener("click", () => {
  movement.mobileSprint = !movement.mobileSprint;
  runToggle.setAttribute("aria-pressed", String(movement.mobileSprint));
  runToggle.classList.toggle("is-active", movement.mobileSprint);
});

jumpButton?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  queueJump();
});

jumpButton?.addEventListener("click", queueJump);

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
  const step = Math.min(delta, 0.05);
  elapsed += step;

  const currentMovement = updatePlayer(step);

  view.yaw = damp(view.yaw, view.targetYaw, 10, step);
  view.pitch = damp(view.pitch, view.targetPitch, 10, step);

  camera.rotation.order = "YXZ";
  camera.rotation.y = view.yaw;
  camera.rotation.x = view.pitch;
  camera.rotation.z = 0;

  const headBob = currentMovement.moving && player.grounded
    ? Math.sin(elapsed * (currentMovement.sprinting ? 14 : 10)) *
      (currentMovement.sprinting ? 0.045 : 0.025)
    : 0;
  camera.position.x = player.position.x;
  camera.position.y = player.position.y + playerConfig.eyeHeight + headBob;
  camera.position.z = player.position.z;

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
