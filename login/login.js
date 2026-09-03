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

const decodeCredential = (credential) => {
  try {
    const encodedPayload = credential.split(".")[1];
    const normalizedPayload = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, "=");
    return JSON.parse(window.atob(paddedPayload));
  } catch {
    return null;
  }
};

const handleCredentialResponse = (response) => {
  const account = response?.credential ? decodeCredential(response.credential) : null;
  const displayName = account?.name || account?.email || "your Google account";

  if (!account) {
    setStatus("Google sign-in could not be completed. Please try again.", "error");
    return;
  }

  setStatus(`Signed in as ${displayName}.`, "success");
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
