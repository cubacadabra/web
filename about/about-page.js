import { getCurrentUser, initializeLogoutButton } from "../src/auth/session.js";

const initializeAuthUI = async () => {
  const user = await getCurrentUser();
  initializeLogoutButton(user);
};

initializeAuthUI();
