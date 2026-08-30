# Cubacadabra

A tiny 3D world built from scratch.

JavaScript. No framework. Shapes, lighting, a baseplate, and a player who can look, move, run, and jump.

Cubacadabra intentionally uses modern vanilla JavaScript rather than TypeScript. One goal of the project is to keep the implementation small, readable, and directly executable in the browser. Type safety is useful, but it is not one of the concepts this project is trying to teach.

## Run it

Install dependencies and start the Vite development server:

```sh
npm install
npm run dev
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
- `src/systems` contains camera, controls, and player movement
- `src/ui` contains DOM access and HUD updates

## Controls

- `W` / `A` / `S` / `D` or the arrow keys to move
- Hold `Shift` to run
- Press `Space` to jump
- Drag the world to look around
- Press `O` to zoom out into third person, `I` to zoom back in
- On touch devices, use the on-screen thumbstick to move, drag the world to look, and use Run, Jump, and View controls
