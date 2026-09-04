import { backendApiUrl } from "../src/config/clientConfig.js";
import { getPostLoginPath } from "../src/auth/session.js";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const googleButton = document.querySelector("#google-button");
const fallbackButton = document.querySelector(".google-button-fallback");
const status = document.querySelector("#login-status");
const googleScript = document.querySelector("#google-identity-services");
let googleInitialized = false;

const setStatus = (message, state = "") => {
  if (!status) return;
  status.textContent = message;
  status.dataset.state = state;
};

const handleCredentialResponse = async (response) => {
  if (!response?.credential) {
    setStatus("Google sign-in could not be completed. Please try again.", "error");
    return;
  }

  setStatus("Signing you in…");

  try {
    const apiResponse = await fetch(backendApiUrl("/auth/google"), {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ credential: response.credential }),
    });
    const result = await apiResponse.json().catch(() => null);

    if (!apiResponse.ok || !result?.user) {
      throw new Error(result?.error || "sign_in_failed");
    }

    setStatus(`Welcome back, ${result.user.name}.`, "success");
    const destination = getPostLoginPath("/");
    window.setTimeout(() => window.location.assign(destination), 450);
  } catch {
    setStatus("We could not finish signing you in. Please try again.", "error");
  }
};

const initializeGoogleButton = () => {
  if (googleInitialized) return true;
  if (!googleButton || !window.google?.accounts?.id) return false;

  if (!GOOGLE_CLIENT_ID) {
    setStatus("Google sign-in is not configured for this environment.", "error");
    fallbackButton?.setAttribute("disabled", "disabled");
    return true;
  }

  window.google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleCredentialResponse,
    context: "signin",
    ux_mode: "popup",
  });

  googleButton.replaceChildren();
  window.google.accounts.id.renderButton(googleButton, {
    type: "standard",
    theme: "outline",
    size: "large",
    text: "continue_with",
    shape: "rectangular",
    logo_alignment: "left",
    width: Math.min(360, googleButton.clientWidth),
  });

  googleInitialized = true;
  return true;
};

const waitForGoogle = (attempt = 0) => {
  if (initializeGoogleButton() || attempt >= 100) return;
  window.setTimeout(() => waitForGoogle(attempt + 1), 100);
};

fallbackButton?.addEventListener("click", () => {
  if (!initializeGoogleButton()) {
    setStatus("Google sign-in is still loading. Please try again in a moment.", "error");
  }
});

googleScript?.addEventListener("load", () => initializeGoogleButton());
waitForGoogle();
