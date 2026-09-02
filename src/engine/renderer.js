const RENDERER_MODULE_PATH = "wasm/renderer/cubacadabra_renderer.js";

export async function createRustRenderer({ canvas }) {
  const moduleUrl = new URL(RENDERER_MODULE_PATH, document.baseURI);
  const bindings = await import(moduleUrl.href);
  const wasmExports = await bindings.default();

  const pixelSize = () => {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    return {
      width: Math.max(1, Math.round(canvas.clientWidth * pixelRatio)),
      height: Math.max(1, Math.round(canvas.clientHeight * pixelRatio)),
    };
  };

  let destroyed = false;
  let size = pixelSize();
  const renderer = await bindings.WebRenderer.create(canvas, size.width, size.height);

  return {
    wasmExports,
    resize() {
      if (destroyed) return;
      size = pixelSize();
      renderer.resize(size.width, size.height);
    },
    render(engineHandle) {
      if (destroyed) return;
      renderer.sync_engine(engineHandle);
      renderer.draw();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      renderer.free();
    },
  };
}
