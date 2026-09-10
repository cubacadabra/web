// This file is copied to public with the generated wasm-bindgen files so the
// browser imports the app runtime outside Vite's source module graph.
window.cubacadabraAppWasm = import("./cubacadabra_app.js").then(async (module) => {
  await module.default();
  return module;
});
