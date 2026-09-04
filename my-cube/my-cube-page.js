import { getCurrentUser, initializeLogoutButton } from "../src/auth/session.js";

const loginPath = `/login/?returnTo=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`;

getCurrentUser().then((user) => {
  if (!user) {
    window.location.replace(loginPath);
    return;
  }

  initializeLogoutButton(user);
  document.body.dataset.authenticated = "true";
});
