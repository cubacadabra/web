import { playerConfig } from "../config/gameConfig.js";
import { clamp } from "../lib/math.js";

const TOTAL_PLAYERS = 18;
const ENTRY_POINTS = [
  { x: -17, z: 12, laneX: -14, laneZ: 4, meetingIndex: 0 },
  { x: 0, z: 16, laneX: 0, laneZ: 3, meetingIndex: 1 },
  { x: 17, z: 12, laneX: 14, laneZ: 4, meetingIndex: 2 },
];

const PALETTES = [
  { shirt: 0xe76f51, pants: 0x355070, skin: 0xf0b18a },
  { shirt: 0x5f8f78, pants: 0x3e5974, skin: 0xd99770 },
  { shirt: 0x748bd2, pants: 0x43515e, skin: 0xf4c39f },
  { shirt: 0xf0b54d, pants: 0x385c62, skin: 0xc98263 },
  { shirt: 0xb276a9, pants: 0x4b5e80, skin: 0xe4a77b },
  { shirt: 0x3f8884, pants: 0x414b5b, skin: 0xf1c29b },
];

const SLOT_OFFSETS = [
  [-1.75, 1.35],
  [0, 1.65],
  [1.75, 1.35],
  [-2.05, -0.45],
  [2.05, -0.45],
  [-0.8, -1.7],
  [0.8, -1.7],
];

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function distanceToTarget(agent) {
  const dx = agent.target.x - agent.avatar.position.x;
  const dz = agent.target.z - agent.avatar.position.z;
  return Math.hypot(dx, dz);
}

function pickRoamTarget(agent) {
  const angle = randomBetween(-Math.PI, Math.PI);
  const distance = randomBetween(2.5, 6.5);
  agent.target.set(
    agent.avatar.position.x + Math.cos(angle) * distance,
    0,
    agent.avatar.position.z + Math.sin(angle) * distance,
  );
  agent.target.x = clamp(agent.target.x, -22, 22);
  agent.target.z = clamp(agent.target.z, -1, 14);
}

function addSeparation(agent, agents, THREE, direction) {
  for (const other of agents) {
    if (other === agent) continue;
    const offsetX = agent.avatar.position.x - other.avatar.position.x;
    const offsetZ = agent.avatar.position.z - other.avatar.position.z;
    const distance = Math.hypot(offsetX, offsetZ);
    if (distance <= 0.001 || distance >= 1.55) continue;

    const strength = (1.55 - distance) / 1.55;
    direction.x += (offsetX / distance) * strength * 1.8;
    direction.z += (offsetZ / distance) * strength * 1.8;
  }

  if (direction.lengthSq() > 1) direction.normalize();
  return direction;
}

function avoidObstacles(agent, obstacles, THREE, direction) {
  for (const obstacle of obstacles) {
    if (obstacle.top > 0.8) continue;

    const closestX = clamp(agent.avatar.position.x, obstacle.minX, obstacle.maxX);
    const closestZ = clamp(agent.avatar.position.z, obstacle.minZ, obstacle.maxZ);
    const offsetX = agent.avatar.position.x - closestX;
    const offsetZ = agent.avatar.position.z - closestZ;
    const distance = Math.hypot(offsetX, offsetZ);
    if (distance <= 0.001 || distance >= 2.1) continue;

    const strength = (2.1 - distance) / 2.1;
    direction.x += (offsetX / distance) * strength * 2.5;
    direction.z += (offsetZ / distance) * strength * 2.5;
  }

  if (direction.lengthSq() > 1) direction.normalize();
  return direction;
}

export function createNpcManager({ THREE, world, colors, obstacles, meetingPoints, createAvatar }) {
  const agents = [];
  const direction = new THREE.Vector3();
  const nextPosition = new THREE.Vector3();
  let nextSpawnAt = 3;

  function getAssemblyTarget(meetingIndex, slotIndex) {
    const meetingPoint = meetingPoints[meetingIndex];
    const offset = SLOT_OFFSETS[slotIndex % SLOT_OFFSETS.length];
    return new THREE.Vector3(
      meetingPoint.position.x + offset[0],
      0.22,
      meetingPoint.position.z + offset[1],
    );
  }

  function spawnNpc(elapsed) {
    const index = agents.length;
    const entry = ENTRY_POINTS[index % ENTRY_POINTS.length];
    const meetingIndex = entry.meetingIndex;
    const slotIndex = Math.floor(index / ENTRY_POINTS.length);
    const avatar = createAvatar({
      THREE,
      world,
      colors,
      palette: PALETTES[index % PALETTES.length],
      visible: true,
    });

    avatar.position.set(
      entry.x + randomBetween(-0.7, 0.7),
      0,
      entry.z + randomBetween(-0.4, 0.4),
    );
    avatar.rotation.y = Math.PI;

    const agent = {
      id: `guest-${String(index + 1).padStart(2, "0")}`,
      avatar,
      target: new THREE.Vector3(entry.laneX, 0, entry.laneZ),
      meetingTarget: getAssemblyTarget(meetingIndex, slotIndex),
      meetingIndex,
      phase: "entering",
      spawnedAt: elapsed,
      nextDecisionAt: elapsed + randomBetween(1.3, 2.8),
      gatherAt: elapsed + randomBetween(7.5, 10.5),
      nextJumpAt: elapsed + randomBetween(1.4, 3.5),
      speed: randomBetween(0.82, 1.08),
      walkCycle: randomBetween(0, Math.PI * 2),
      grounded: true,
      verticalVelocity: 0,
      assembled: false,
    };

    agents.push(agent);
  }

  function updateAgent(agent, elapsed, delta) {
    if (agent.phase === "entering" && distanceToTarget(agent) < 1.2) {
      agent.phase = "roaming";
      pickRoamTarget(agent);
      agent.nextDecisionAt = elapsed + randomBetween(1.2, 2.7);
    }

    if (agent.phase === "roaming") {
      if (elapsed >= agent.gatherAt) {
        agent.phase = "assembling";
        agent.target.copy(agent.meetingTarget);
      } else if (elapsed >= agent.nextDecisionAt || distanceToTarget(agent) < 1) {
        pickRoamTarget(agent);
        agent.nextDecisionAt = elapsed + randomBetween(1.1, 2.4);
      }
    }

    if (agent.phase === "assembling" && distanceToTarget(agent) < 0.65) {
      agent.phase = "assembled";
      agent.assembled = true;
      agent.target.copy(agent.meetingTarget);
    }

    direction.set(
      agent.target.x - agent.avatar.position.x,
      0,
      agent.target.z - agent.avatar.position.z,
    );
    if (agent.phase !== "assembled" && direction.lengthSq() > 0.02) {
      direction.normalize();
      addSeparation(agent, agents, THREE, direction);
      avoidObstacles(agent, obstacles, THREE, direction);

      const isRunning = agent.phase === "entering"
        ? Math.sin(elapsed * 1.35 + agent.spawnedAt) > -0.25
        : Math.sin(elapsed * 1.1 + agent.spawnedAt * 2) > 0.35;
      const speed = (isRunning ? playerConfig.runSpeed : playerConfig.walkSpeed * 0.62) * agent.speed;
      nextPosition.copy(agent.avatar.position);
      nextPosition.x += direction.x * speed * delta;
      nextPosition.z += direction.z * speed * delta;
      nextPosition.x = clamp(nextPosition.x, -playerConfig.worldLimit, playerConfig.worldLimit);
      nextPosition.z = clamp(nextPosition.z, -playerConfig.worldLimit, playerConfig.worldLimit);
      agent.avatar.position.x = nextPosition.x;
      agent.avatar.position.z = nextPosition.z;
      agent.avatar.rotation.y = Math.atan2(direction.x, direction.z);
      agent.walkCycle += delta * (isRunning ? 13 : 9);
    } else {
      agent.walkCycle += delta * 2.2;
      agent.avatar.rotation.y += Math.sin(elapsed * 0.75 + agent.spawnedAt) * delta * 0.14;
    }

    if (
      agent.grounded &&
      agent.phase !== "assembled" &&
      elapsed >= agent.nextJumpAt
    ) {
      agent.verticalVelocity = playerConfig.jumpVelocity * randomBetween(0.78, 0.95);
      agent.grounded = false;
      agent.nextJumpAt = elapsed + randomBetween(3.8, 7.2);
    }

    if (!agent.grounded) {
      agent.verticalVelocity -= playerConfig.gravity * delta;
      agent.avatar.position.y += agent.verticalVelocity * delta;
      if (agent.avatar.position.y <= 0) {
        agent.avatar.position.y = 0;
        agent.verticalVelocity = 0;
        agent.grounded = true;
      }
    }

    const parts = agent.avatar.userData.animationParts;
    const stride = agent.phase === "assembled" ? 0.03 : Math.sin(agent.walkCycle) * 0.5;
    parts.leftArm.rotation.x = stride;
    parts.rightArm.rotation.x = -stride;
    parts.leftLeg.rotation.x = -stride;
    parts.rightLeg.rotation.x = stride;
    parts.torso.position.y = 1.82 + (agent.grounded ? Math.abs(Math.sin(agent.walkCycle)) * 0.025 : 0);
  }

  function update(elapsed, delta) {
    if (agents.length < TOTAL_PLAYERS - 1 && elapsed >= nextSpawnAt) {
      spawnNpc(elapsed);
      nextSpawnAt += 3;
    }

    for (const agent of agents) updateAgent(agent, elapsed, delta);

    const meetingCounts = meetingPoints.map((_, index) => agents.filter(
      (agent) => agent.meetingIndex === index && agent.assembled,
    ).length);

    return {
      totalPlayers: agents.length + 1,
      meetingCounts,
      isFull: agents.length >= TOTAL_PLAYERS - 1,
    };
  }

  return { update };
}
