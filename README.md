# Cubacadabra web client

This repository is the browser client: vanilla JavaScript owns the page, HUD,
input, and networking adapter, while Rust compiled to WebAssembly owns game
simulation and the shared `wgpu` renderer. The browser also serves the
`first-game` package as static files so the iOS app can load the same content.

The five repositories work together as follows:

```text
first-game  -> manifest.json + game.luau (content and rules)
rust        -> simulation and renderer compiled to WebAssembly
web         -> this browser shell and package host
backend     -> multiplayer Worker at /world/:worldId
ios_app     -> native client using the same package and Rust runtime
```

When starting here, read [first-game/README.md](../first-game/README.md) next
to understand the package this app loads. Then read
[rust/README.md](../rust/README.md) for the engine boundary or
[backend/README.md](../backend/README.md) for the multiplayer service.

The repositories are expected to be sibling directories because the sync and
Rust build scripts use `../first-game` and `../rust`.

## Local development

Install dependencies and start Vite. The command automatically syncs the
current sibling game package and builds the Rust renderer before starting:

```sh
cargo install wasm-bindgen-cli  # one time; requires Rust/Cargo
npm install
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`. To use local
multiplayer, start the backend in another terminal first:

```sh
cd ../backend
npm install
npm run dev
```

Development defaults are:

```text
Game package: http://localhost:5173/games/first-game/
Backend:      ws://127.0.0.1:8787
```

The browser joins the backend at `/world/lobby` and changes to the destination
world from the game manifest after a launch-pad session. Run
`npm run sync:game` when you want to refresh only the copied package.

## Dev LAN mode

For a browser or iOS device on the same LAN, bind both servers to all network
interfaces. Replace `192.168.1.10` with the Mac's LAN IP:

```sh
# terminal 1, from backend/
npm run dev:lan

# terminal 2, from web/
VITE_BACKEND_WS_URL=ws://192.168.1.10:8787 npm run dev:lan
```

Open `http://192.168.1.10:5173` on the other device. The
`VITE_BACKEND_WS_URL` override matters because `127.0.0.1` on a phone or
tablet means that device, not the Mac running Wrangler. For iOS, also set the
package and backend URLs in the Xcode scheme as shown in
[ios_app/README.md](../ios_app/README.md).

## Production endpoints

Production uses the deployed web site and Worker:

```text
Web:     https://cubacadabra.com/
Package: https://cubacadabra.com/games/first-game/
Backend: wss://cubacadabra.andrew-f97.workers.dev
```

Production Vite builds select the production Worker automatically. To run the
development server against the production Worker while keeping live reload:

```sh
VITE_BACKEND_WS_URL=wss://cubacadabra.andrew-f97.workers.dev npm run dev
```

To build and preview the production web client locally:

```sh
npm run build
npm run preview
```

That preview serves the package locally but uses the production Worker because
the build is a production build. The deployment helper `./deploy.sh` builds
the site and publishes its `dist/` output to the sibling `deployed`
repository; use it only when you intend to update the public site.

## Structure

- `src/app/` — wires the game, engine, renderer, and socket together
- `src/config/` — browser presentation defaults and backend URL override
- `src/game/` — loads and normalizes the external game package
- `src/engine/` — Rust/WebAssembly runtime and renderer boundary
- `src/network/` — backend WebSocket client and reconnect behavior
- `src/state/` — mutable game state
- `src/systems/` — browser input adapters
- `src/ui/` — DOM access and HUD updates
- `scripts/sync_first_game.sh` — copies the sibling package into `public/`

The project intentionally remains JavaScript-only. Do not add TypeScript or a
frontend framework without changing that project decision explicitly.

## Controls

- `W` / `A` / `S` / `D` or the arrow keys to move
- Hold `Shift` to run
- Press `Space` to jump
- Drag the world to look around
- Press `O` to zoom out into third person; `I` to zoom back in
- On touch devices, use the thumbstick, look gesture, Run, Jump, and View
  controls

## Where to look next

- [first-game/README.md](../first-game/README.md) — package schema and game
  behavior
- [rust/README.md](../rust/README.md) — simulation and WASM renderer
- [backend/README.md](../backend/README.md) — local/LAN/production multiplayer
