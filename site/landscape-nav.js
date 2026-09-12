const mobileLandscapeNavigation = window.matchMedia("(max-width: 720px)");

const setLandscapeNavigationState = (sidebar, open) => {
  const toggle = sidebar.querySelector(".about-sidebar-toggle");
  if (!toggle) return;

  sidebar.classList.toggle("is-menu-open", open);
  toggle.setAttribute("aria-expanded", String(open));
};

const syncLandscapeNavigation = () => {
  document.querySelectorAll(".landscape-sidebar").forEach((sidebar) => {
    setLandscapeNavigationState(sidebar, !mobileLandscapeNavigation.matches);
  });
};

document.querySelectorAll(".landscape-sidebar").forEach((sidebar) => {
  const toggle = sidebar.querySelector(".about-sidebar-toggle");
  if (!toggle) return;

  toggle.addEventListener("click", () => {
    setLandscapeNavigationState(sidebar, !sidebar.classList.contains("is-menu-open"));
  });

  toggle.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setLandscapeNavigationState(sidebar, false);
      toggle.focus();
    }
  });

  sidebar.querySelectorAll(".landscape-menu a").forEach((link) => {
    link.addEventListener("click", () => {
      if (mobileLandscapeNavigation.matches) setLandscapeNavigationState(sidebar, false);
    });
  });
});

syncLandscapeNavigation();
if (mobileLandscapeNavigation.addEventListener) {
  mobileLandscapeNavigation.addEventListener("change", syncLandscapeNavigation);
} else {
  mobileLandscapeNavigation.addListener(syncLandscapeNavigation);
}
