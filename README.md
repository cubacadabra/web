# Cubacadabra

A tiny 3D world built from scratch.

JavaScript. No framework. Shapes, lighting, a baseplate, and a player who can look, move, run, and jump.

Cubacadabra intentionally uses modern vanilla JavaScript rather than TypeScript. One goal of the project is to keep the implementation small, readable, and directly executable in the browser. Type safety is useful, but it is not one of the concepts this project is trying to teach.

## Run it

The browser needs a local server to load ES modules. From this directory, run:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

Three.js is loaded as a pinned browser module from jsDelivr. There is no build step yet.

## Controls

- `W` / `A` / `S` / `D` or the arrow keys to move
- Hold `Shift` to run
- Press `Space` to jump
- Drag the world to look around
- Press `O` to zoom out into third person, `I` to zoom back in
