import "../styles.css";
import { createGame } from "./app/createGame.js";

createGame().catch((error) => {
  console.error(error);
  const loadingState = document.querySelector("#loading-state");
  if (loadingState) {
    loadingState.textContent = "The world could not start. Refresh to try again.";
    loadingState.classList.add("is-error");
  }
});
