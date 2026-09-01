# Cubacadabra

A tiny 3D world built from scratch.

Rust simulation compiled to WebAssembly, with vanilla JavaScript and Three.js
handling presentation and input. The sample game package lives in the sibling
`first-game` repository and contains its world manifest plus Luau rules.

Cubacadabra intentionally uses modern vanilla JavaScript rather than
TypeScript. Rust owns platform services such as movement, collision, and the
launch-pad lifecycle. Game authors write portable rules in Luau; clients add
only their renderer, input, and native lifecycle adapters.

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
- `src/config` holds renderer-only input and camera tuning
- `src/game` loads the external game package at runtime
- `src/scene` creates the Three.js scene, environment, and avatar
- `src/state` owns the mutable game state
- `src/engine` loads the Rust/WebAssembly simulation boundary
- `src/systems` contains camera, controls, and the Three.js NPC adapter
- `src/ui` contains DOM access and HUD updates

## Shared game pattern

The first reusable platform pattern is the launch pad. The game package
defines pad content in `../first-game/manifest.json`—position, label, color,
radius, and countdown duration. The browser registers those pads with Rust,
which owns occupancy, countdown cancellation, and the launch event. The
JavaScript client only loads the package, forwards content to the engine, and
formats the returned state.

This is the direction for Cubacadabra games: keep deterministic simulation,
physics, and reusable multiplayer patterns in a platform-neutral Rust runtime;
keep game-specific rules in the external Luau package; and keep each client
thin. A future iOS or Android client can use the same C-compatible engine
lifecycle (`create → load script → configure content → input → step → read
frame → destroy`) and provide its own native renderer. The native Rust host
already embeds Luau through `mlua`; the current browser target exposes the
same script seam while its dedicated Luau-WASM runtime is being added.

## Controls

- `W` / `A` / `S` / `D` or the arrow keys to move
- Hold `Shift` to run
- Press `Space` to jump
- Drag the world to look around
- Press `O` to zoom out into third person, `I` to zoom back in
- On touch devices, use the on-screen thumbstick to move, drag the world to look, and use Run, Jump, and View controls
