// GPU startup cannot be cancelled by the browser host. If it completes after
// our deadline, release the WASM renderer instead of leaving an orphaned device.
export function initializeRenderer(start, timeoutMs = 30_000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const deadline = setTimeout(() => {
      settled = true;
      const error = new Error("Browser graphics did not start in time.");
      error.name = "RendererStartupTimeout";
      reject(error);
    }, timeoutMs);

    Promise.resolve().then(start).then((result) => {
      if (settled) {
        result.renderer.free();
        return;
      }
      settled = true;
      clearTimeout(deadline);
      resolve(result);
    }).catch((error) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      reject(error);
    });
  });
}
