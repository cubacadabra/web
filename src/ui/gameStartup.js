export function showGameStartupError(error) {
  const loadingState = document.querySelector("#loading-state");
  if (!loadingState) return;
  loadingState.hidden = false;
  document.querySelector("#loading-copy").textContent = error.name === "RendererStartupTimeout"
    ? "Browser graphics did not start. Try again or open the game in Studio."
    : document.querySelector("#world-shell")?.classList.contains("is-ready")
      ? "The game stopped. Try again or follow the local Studio guide."
      : "The game could not start. Try again or follow the local Studio guide.";
  document.querySelector("#loading-actions").hidden = false;
  document.querySelector("#loading-retry").onclick = () => window.location.reload();
  loadingState.setAttribute("role", "alert");
  loadingState.classList.remove("is-ready");
  loadingState.classList.add("is-error");
}
