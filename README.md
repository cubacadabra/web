# Cubacadabra

A tiny 3D world built from scratch.

Rust simulation compiled to WebAssembly, with vanilla JavaScript and Three.js
handling presentation and input. Shapes, lighting, a baseplate, and a player
who can look, move, run, and jump.

Cubacadabra intentionally uses modern vanilla JavaScript rather than
TypeScript. Rust owns the platform-neutral game simulation so this browser
client and a future iOS app can share the same engine.

## Run it

Install dependencies and start the Vite development server:

```sh
npm install
npm run dev
```

The WebAssembly artifact is committed under `public/wasm` for immediate local
startup. Rebuild it after changing Rust with:

```sh
npm run build:wasm
```

Then open the local URL printed by Vite, usually `http://localhost:5173`.

Create a production build with `npm run build`, or serve the build locally with
`npm run preview`. Three.js is installed as a regular dependency and bundled by
Vite. The project intentionally remains plain JavaScript with no framework.

## Structure

- `src/app` wires the game together
- `src/config` holds world and player tuning
- `src/scene` creates the Three.js scene, environment, and avatar
- `src/state` owns the mutable game state
- `src/engine` loads the Rust/WebAssembly simulation boundary
- `src/systems` contains camera, controls, and the Three.js NPC adapter
- `src/ui` contains DOM access and HUD updates

## Shared game pattern

The first reusable platform pattern is the launch pad. A world author defines
pad content in `src/config/gameConfig.js`—position, label, color, radius, and
countdown duration. The browser registers those pads with Rust, which owns
occupancy, countdown cancellation, and the launch event. The JavaScript client
only formats the state and renders the world-specific presentation.

This is the direction for Cubacadabra games: keep deterministic simulation,
physics, and reusable multiplayer patterns in a platform-neutral Rust runtime;
keep each world's content and renderer adapter in a small client layer. A
future iOS or Android client can use the same C-compatible engine lifecycle
(`create → configure → input → step → read frame → destroy`) and provide its
own native renderer. For richer game-specific rules, prefer a portable Rust
game module over embedding platform logic in JavaScript; use declarative data
for world content where both web and native clients need to load the same
world.

## Controls

- `W` / `A` / `S` / `D` or the arrow keys to move
- Hold `Shift` to run
- Press `Space` to jump
- Drag the world to look around
- Press `O` to zoom out into third person, `I` to zoom back in
- On touch devices, use the on-screen thumbstick to move, drag the world to look, and use Run, Jump, and View controls
