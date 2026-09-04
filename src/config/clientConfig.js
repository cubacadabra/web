export const zoomConfig = {
  step: 8,
  maxDistance: 16,
  thirdPersonThreshold: 0.75,
};

// These are presentation and input defaults for this renderer. Simulation
// values are owned by the Rust engine and game package data is owned by the
// game repository.
export const playerPresentationConfig = {
  eyeHeight: 3.4,
};

const productionBackendUrl = "wss://api.cubacadabra.com";
const localBackendUrl = "ws://127.0.0.1:8787";

export const backendConfig = {
  webSocketUrl: import.meta.env.VITE_BACKEND_WS_URL
    || (import.meta.env.DEV ? localBackendUrl : productionBackendUrl),
};

export function backendApiUrl(path) {
  const url = new URL(backendConfig.webSocketUrl);
  url.protocol = url.protocol === "wss:" ? "https:" : "http:";
  url.pathname = path;
  url.search = "";
  url.hash = "";
  return url;
}
