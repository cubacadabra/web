const route = window.location.pathname.replace(/\/+$/, "") || "/";

if (route === "/about") {
  window.location.replace("/about/");
} else if (route === "/sudo-cadabra" || route.startsWith("/sudo-cadabra/")) {
  import("./admin/sudoCadabra.js")
    .then(({ mountSudoCadabra }) => mountSudoCadabra())
    .catch((error) => {
      console.error(error);
      document.body.textContent = "Sudo-cadabra could not start.";
    });
} else {
  import("./app/createGame.js")
    .then(({ createGame }) => createGame())
    .catch((error) => {
      console.error(error);
      const loadingState = document.querySelector("#loading-state");
      if (loadingState) {
        loadingState.textContent = "The world could not start. Refresh to try again.";
        loadingState.classList.add("is-error");
      }
    });
}
