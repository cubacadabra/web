import { AppRuntime } from "./AppRuntime.js";
import { backendApiUrl } from "../config/clientConfig.js";

let runtime;
let loading;
let sessionUser = null;

// One instance for the signed-in document, shared across account screens.
export function initializeAccountRuntime(user) {
  sessionUser = user;
  if (!loading) {
    loading = (async () => {
      const modulePath = "/wasm/app/cubacadabra_app.js";
      const wasm = await import(/* @vite-ignore */ modulePath);
      await wasm.default();
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
