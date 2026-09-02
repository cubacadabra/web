# Cubacadabra

A tiny 3D world built from scratch.

Rust simulation and renderer compiled to WebAssembly, with vanilla JavaScript
handling the browser shell, HUD, and input. The sample game package lives in the sibling
`first-game` repository and contains its world manifest plus Luau rules.

Cubacadabra intentionally uses modern vanilla JavaScript rather than
TypeScript. Rust owns platform services such as movement, collision, and the
launch-pad lifecycle. Game authors write portable rules in Luau; clients add
only their renderer, input, and native lifecycle adapters.

## Run it

Install dependencies and start the Vite development server:

```sh
npm install
# one-time tool used by the shared browser renderer build
cargo install wasm-bindgen-cli
npm run dev
```

The build produces one Rust/WASM runtime under `public/wasm/renderer`. It owns
the simulation, manifest parsing, and shared `wgpu` renderer. Rebuild it after
changing Rust with:

```sh
npm run build:renderer
```

Then open the local URL printed by Vite, usually `http://localhost:5173`.

Create a production build with `npm run build`, or serve the build locally with
`npm run preview`. The project intentionally remains plain JavaScript with no
framework. The browser and iOS clients both submit the same render records to
the Rust renderer; only their surface setup is platform-specific.

## Structure

- `src/app` wires the game together
- `src/config` holds browser input tuning
- `src/game` loads the external game package at runtime
- `src/state` owns the mutable game state
- `src/engine` loads the unified Rust/WebAssembly runtime boundary
- `src/systems` contains browser input adapters
- `src/ui` contains DOM access and HUD updates

## Shared game pattern

The first reusable platform pattern is the launch pad. The game package
defines pad content in `../first-game/manifest.json`—position, label, color,
radius, and countdown duration. The browser registers those pads with Rust,
which owns occupancy, countdown cancellation, and the launch event. Rust parses
the package once for both simulation and rendering; JavaScript fetches the
files, forwards input, and formats returned HUD state.

This is the direction for Cubacadabra games: keep deterministic simulation,
physics, reusable multiplayer patterns, and world rendering in a
platform-neutral Rust runtime; keep game-specific rules in the external Luau
package; and keep each client thin. The browser uses the generated
`WebRenderer` binding over a canvas and synchronizes it directly from the Rust
engine, while iOS uses the same engine-to-renderer path through the C ABI and a
`CAMetalLayer`. Android can use the same Rust renderer through its future native
surface adapter.

## Controls

- `W` / `A` / `S` / `D` or the arrow keys to move
- Hold `Shift` to run
- Press `Space` to jump
- Drag the world to look around
- Press `O` to zoom out into third person, `I` to zoom back in
- On touch devices, use the on-screen thumbstick to move, drag the world to look, and use Run, Jump, and View controls
