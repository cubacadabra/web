import { backendApiUrl } from "../config/clientConfig.js";

const requestOptions = {
  credentials: "include",
};

export async function getCurrentUser() {
  try {
    const response = await fetch(backendApiUrl("/auth/me"), requestOptions);
    if (!response.ok) return null;

    const result = await response.json().catch(() => null);
    return result?.user || null;
  } catch {
    return null;
  }
}

export async function logout() {
  const response = await fetch(backendApiUrl("/auth/logout"), {
    ...requestOptions,
    method: "POST",
  });

  if (!response.ok) throw new Error("logout_failed");
}

export function initializeLogoutButton(user) {
  const logoutButton = document.querySelector("[data-auth-logout]");
  if (!user || !logoutButton) return;

  logoutButton.hidden = false;
  logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;
    logoutButton.textContent = "logging out…";
    try {
      await logout();
    } catch {
      // Returning to About still gives the user a safe exit if the API is unavailable.
    }
    window.location.assign("/about/");
  });
}

export function getPostLoginPath(fallback = "/") {
  const requestedPath = new URLSearchParams(window.location.search).get("returnTo");
  if (!requestedPath || !requestedPath.startsWith("/") || requestedPath.startsWith("//")) {
    return fallback;
  }

  return requestedPath;
}
