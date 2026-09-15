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
const defaultGoogleClientId = "488093116930-15iua7ac30985v925s2d66alqplk6ib6.apps.googleusercontent.com";

export const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  && import.meta.env.VITE_GOOGLE_CLIENT_ID !== "changeme"
  ? import.meta.env.VITE_GOOGLE_CLIENT_ID
  : defaultGoogleClientId;

export const backendConfig = {
  webSocketUrl: import.meta.env.VITE_BACKEND_WS_URL
    || (import.meta.env.DEV ? localBackendUrl : productionBackendUrl),
};

export function backendApiUrl(path) {
  const url = new URL(backendConfig.webSocketUrl);
  const queryIndex = path.indexOf("?");
  const pathname = queryIndex === -1 ? path : path.slice(0, queryIndex);
  const query = queryIndex === -1 ? "" : path.slice(queryIndex + 1);
  url.protocol = url.protocol === "wss:" ? "https:" : "http:";
  url.pathname = pathname;
  url.search = query ? `?${query}` : "";
  url.hash = "";
  return url;
}
