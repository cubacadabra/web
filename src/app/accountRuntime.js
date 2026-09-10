import { AppRuntime } from "./AppRuntime.js";
import { backendApiUrl } from "../config/clientConfig.js";

let runtime;
let loading;
let sessionUser = null;

function loadAppRuntimeWasm() {
  if (window.cubacadabraAppWasm) return window.cubacadabraAppWasm;
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.type = "module";
    script.src = "/wasm/app/load-app-runtime.js";
    script.onload = () => resolve(window.cubacadabraAppWasm);
    script.onerror = () => reject(new Error("The app runtime loader is unavailable"));
    document.head.append(script);
  });
}

// One instance for the signed-in document, shared across account screens.
export function initializeAccountRuntime(user) {
  sessionUser = user;
  if (!loading) {
    loading = (async () => {
      const wasm = await loadAppRuntimeWasm();
      if (!wasm) throw new Error("The app runtime loader is unavailable");
      runtime = new AppRuntime(new wasm.WebApp(), async (effect, signal) => {
        const response = await fetch(backendApiUrl("/" + effect.path), {
          method: effect.method, body: effect.body, signal,
          credentials: "include", headers: { "content-type": "application/json" },
        });
        return { status: response.status, body: await response.text() };
      });
      await replaceSession();
      return runtime;
    })().catch((error) => { loading = null; throw error; });
  } else if (runtime) {
    replaceSession();
  }
  return loading;
}

function replaceSession() {
  return runtime?.dispatch({ type: "replace_session", account_id: sessionUser?.id ?? null,
    username: sessionUser?.username ?? null, body_id: sessionUser?.body_id ?? null,
    date_of_birth: sessionUser?.dob ?? null });
}

export function clearAccountSession() {
  sessionUser = null;
  replaceSession(); // Also handles sign-out while WASM is still loading.
}
