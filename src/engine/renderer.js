const RENDERER_MODULE_PATH = "wasm/renderer/cubacadabra_renderer.js";

export async function createRustRenderer({ canvas }) {
  const siteBaseURL = new URL(import.meta.env.BASE_URL, document.baseURI);
  const moduleUrl = new URL(RENDERER_MODULE_PATH, siteBaseURL);
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
    bindings,
    wasmExports,
    resize() {
      if (destroyed) return;
      size = pixelSize();
      renderer.resize(size.width, size.height);
    },
    setPackageImage(id, width, height, pixels) {
      if (destroyed) return false;
      return renderer.set_package_image(id, width, height, pixels);
    },
    setPackageImageAtlas(width, height, pixels, regions) {
      if (destroyed) return false;
      return renderer.set_package_image_atlas(width, height, pixels, regions);
    },
    registerMorphPack(bytes) {
      if (destroyed) return false;
      return renderer.register_morph_pack(bytes);
    },
    setAvatarPreviewMode(enabled) {
      if (destroyed) return;
      renderer.set_avatar_preview_mode(Boolean(enabled));
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
