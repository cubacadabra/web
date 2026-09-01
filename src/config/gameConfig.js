export const colors = {
  ground: 0x8caf83,
  groundEdge: 0x5f806d,
  grid: 0x71977e,
  coral: 0xed725b,
  butter: 0xf2c764,
  periwinkle: 0x7898dc,
  ink: 0x264b4b,
  paper: 0xf6f1e7,
};

// World content stays in the client so each renderer can dress the same
// platform behavior in its own presentation. Rust receives these as launch
// pad registrations and owns the countdown and launch event.
export const launchPads = [
  {
    code: "GATE 01",
    label: "SUN COURT",
    position: [-10, -3],
    color: colors.coral,
    radius: 2.7,
    countdown: 8,
  },
  {
    code: "GATE 02",
    label: "DEEP DIVE",
    position: [0, -7],
    color: colors.butter,
    radius: 2.7,
    countdown: 8,
  },
  {
    code: "GATE 03",
    label: "SKY RUN",
    position: [10, -3],
    color: colors.periwinkle,
    radius: 2.7,
    countdown: 8,
  },
];

export const initialView = {
  yaw: 0,
  pitch: -0.095,
};

export const zoomConfig = {
  step: 8,
  maxDistance: 16,
  thirdPersonThreshold: 0.75,
};

export const playerConfig = {
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

export const lookConfig = {
  maxPitch: 1.1,
  sensitivity: 0.0062,
};
