# cubacadabra web client

This repository is the browser client: vanilla JavaScript owns the page, HUD,
input, and networking adapter, while Rust compiled to WebAssembly owns game
simulation, the Luau host, and the shared `wgpu` renderer. The browser also
serves the sibling game packages as static files so clients can load the
selected content.

The repositories work together as follows:

```text
examples    -> authored game projects, with Cuboom as the starting point
rust        -> simulation and renderer compiled to WebAssembly
web         -> this browser shell and package host
backend     -> identity, package delivery, and world WebSockets
ios/android -> native clients using the same package and Rust runtime
```

Start with [Cuboom](https://github.com/cubacadabra/examples/blob/main/cuboom/README.md) and the
[platform contribution guide](https://github.com/cubacadabra/docs/blob/main/CONTRIBUTING.md). Cubacadabra is pre-launch;
[the current scope](https://github.com/cubacadabra/docs/blob/main/CURRENT_STATE.md) names the available foundations and gaps.
Then read
[rust/README.md](https://github.com/cubacadabra/rust/blob/main/README.md) for the engine boundary or
[backend/README.md](https://github.com/cubacadabra/backend/blob/main/README.md) for the multiplayer service.

The repositories are expected to be sibling directories because the default
sync and Rust build scripts use the sibling game projects and `../rust`.

## Local development

Install Node 22.18 or newer, stable Rust, and the matching WASM binding tool,
then start Vite. The command automatically syncs the
sibling game packages and builds the Rust renderer before starting:

```sh
cargo install wasm-bindgen-cli --version 0.2.127 --locked  # matches rust/Cargo.lock
npm ci
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`. To use local
multiplayer, start the backend in another terminal first:

```sh
cd ../backend
npm install
npm run dev
```

Every routable HTML document, including the root world SPA, is generated from
the dry sources in `site/`. `site/site-routes.js` owns route metadata and
site-wide metadata such as the social image. `site/content/` contains only
page-specific body content. `scripts/build-site-pages.js` owns the shared
document head, header, footer, and static-page layouts.

Vite generates temporary HTML inputs under its ignored cache, serves them at
their normal URLs during development, and emits static `index.html` files to
`dist/` during a production build. No routable HTML is checked into this
repository. Run `npm run build:pages` only when you want to inspect the
generated pages in the ignored `.generated/` directory.

Development defaults are:

```text
Default game: http://localhost:5173/?game=heavy2 (Cuboom)
Packages:     http://localhost:5173/games/<manifest-id>/
Backend:      ws://127.0.0.1:8787
```

The browser follows the package launch configuration. Cuboom starts directly
in its game world; older examples may pass through the shared lobby. `npm run sync:games`
builds the sibling game packages into the served directory; run it when you
want to refresh only the game packages.

To run a newly created project without editing this repository, build it into
the served local package directory:

```sh
sh ../tools/scripts/cubacadabra.sh build-game \
  --source ~/games/my-game --output public/games/my-game
```

Then open `?game=my-game`. The loader checks any local `public/games/<id>/`
package before falling back to the uploaded-game endpoint. Multiple projects
can also be synced with `sh scripts/sync_games.sh ~/games/my-game`.

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
[ios/README.md](https://github.com/cubacadabra/ios/blob/main/README.md).

## Production endpoints

Production uses the deployed web site and Worker:

```text
Web:     https://cubacadabra.com/
Package: https://cubacadabra.com/games/heavy2/
Backend: wss://api.cubacadabra.com
```

Production Vite builds select the production Worker automatically. To run the
development server against the production Worker while keeping live reload:

```sh
VITE_BACKEND_WS_URL=wss://api.cubacadabra.com npm run dev
```

To build and preview the production web client locally:

```sh
npm run build
npm run preview
```

That preview serves the package locally but uses the production Worker because
the build is a production build. `dist/` is the complete GitHub Pages
artifact, including the generated route tree, sitemap, `CNAME`, `.nojekyll`,
and `404.html` fallback. The deployment helper `sh deploy.sh` rebuilds and prepares local changes in
an existing, clean sibling `deployed` checkout. It preserves Git history and
performs no commit or push. It rejects generated JSON above 4,000,000 bytes
before touching that checkout. Review the diff before any explicit publication.
The public release build includes Cuboom, Schoolyard, and Signal Run, defined
in `scripts/featured-games.js`. Regular `npm run build` includes all examples.
Maze and Vegas generate runtime JSON above the commit limit and remain local
import experiments until their distribution representation is redesigned.

## Verification

```sh
npm run check:app
npm run check:startup
npm run check:deployment
npm run build:release
```

If browser graphics does not start within 30 seconds, the player offers retry,
the Studio guide, and downloads. A stalled identity lookup falls back to guest
play after five seconds. GPU startup still needs real browser/device testing;
successful WASM package loading alone does not prove rendering.

Review `/developer/` at mobile and desktop widths. Its start commands and
capability notes come from local source; the canonical docs live in `../docs`.
The `developer` sibling is a small resource gateway, not a second documentation
corpus. Service plans are secondary to the open-source build path.

## Structure

- `src/app/`   wires the game, engine, renderer, and socket together
- `src/config/`   browser presentation defaults and backend URL override
- `src/game/`   loads and normalizes the external game package
- `src/engine/`   Rust/WebAssembly runtime and renderer boundary
- `src/network/`   backend WebSocket client and reconnect behavior
- `src/state/`   mutable game state
- `src/systems/`   browser input adapters
- `src/ui/`   DOM access and HUD updates
- `site/site-routes.js`   all route and shared metadata
- `site/content/`   page-specific HTML fragments
- `scripts/build-site-pages.js`   shared HTML templates and page generator
- `scripts/sync_games.sh`   builds the sibling game packages into `public/`

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

When running the web client in development, open the `Character lab` from the
top-right corner to review the Phase 4/5 development selector. It includes all
21 authored expressions, the wave action, all three bodies, the six outfit
recipes, compatibility checks, and live idle/walk/run/jump input. It is
available in a production build only with `?showcase=1`. Appearance previews
use the Phase 7 local appearance API when available, persist in local storage,
and are sent to the connected world host. Older WASM builds fall back to the
Phase 5 package appearance schema. Wave remains a client-side intent until the
Rust host exposes a local emote setter. Use `Face camera` while
reviewing expressions; it uses a showcase-only reverse movement assist to keep
the player facing the camera with the current engine API.

The Phase 6 renderer applies automatic projected-size LOD, conservative
presentation culling, and bounded effects behind the same client surface.
`Reduced effects` exercises the renderer's presentation preference; the
quality policy does not change simulation or character identity.

## Where to look next

- [Cuboom](https://github.com/cubacadabra/examples/blob/main/cuboom/README.md)   default game and contribution priorities
- [second-game/README.md](https://github.com/cubacadabra/examples/blob/main/second-game/README.md)   second game behavior
- [third-game/README.md](https://github.com/cubacadabra/examples/blob/main/third-game/README.md)   preview SDK capability probe
- [Cubacadabra creator guide](https://github.com/cubacadabra/docs/blob/main/contracts/creator-guide.md)   game developer guide
- [rust/README.md](https://github.com/cubacadabra/rust/blob/main/README.md)   simulation and WASM renderer
- [backend/README.md](https://github.com/cubacadabra/backend/blob/main/README.md)   local/LAN/production multiplayer

### Licensing

Copyright (C) 2026 Andrew Arrow

Licensed under the GNU General Public License v3.0 or later.
See [LICENSE](LICENSE).
