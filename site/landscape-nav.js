const mobileLandscapeNavigation = window.matchMedia("(max-width: 720px)");

const setLandscapeNavigationState = (header, open) => {
  const toggle = header.querySelector(".landscape-topbar-toggle");
  if (!toggle) return;

  header.classList.toggle("is-mobile-nav-open", open);
  toggle.setAttribute("aria-expanded", String(open));
  toggle.setAttribute("aria-label", open ? "Close site menu" : "Open site menu");
};

const syncLandscapeNavigation = () => {
  document.querySelectorAll(".landscape-page .about-topbar").forEach((header) => {
    setLandscapeNavigationState(header, false);
  });
};

document.querySelectorAll(".landscape-page .about-topbar").forEach((header) => {
  const toggle = header.querySelector(".landscape-topbar-toggle");
  if (!toggle) return;

  toggle.addEventListener("click", () => {
    setLandscapeNavigationState(header, !header.classList.contains("is-mobile-nav-open"));
  });

  toggle.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setLandscapeNavigationState(header, false);
      toggle.focus();
    }
  });

  header.querySelectorAll(".landscape-topbar-nav a").forEach((link) => {
    link.addEventListener("click", () => setLandscapeNavigationState(header, false));
  });
});

syncLandscapeNavigation();
if (mobileLandscapeNavigation.addEventListener) {
  mobileLandscapeNavigation.addEventListener("change", syncLandscapeNavigation);
} else {
  mobileLandscapeNavigation.addListener(syncLandscapeNavigation);
}
