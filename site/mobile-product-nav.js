const mobileProductNavigation = window.matchMedia("(max-width: 720px)");

const setProductNavigationState = (header, open) => {
  const toggle = header.querySelector(".mobile-product-nav-toggle");
  if (!toggle) return;

  header.classList.toggle("is-mobile-nav-open", open);
  toggle.setAttribute("aria-expanded", String(open));
  toggle.setAttribute("aria-label", open ? "Close site menu" : "Open site menu");
};

const syncProductNavigation = () => {
  document.querySelectorAll(".about-page .about-topbar").forEach((header) => {
    setProductNavigationState(header, false);
  });
};

document.querySelectorAll(".about-page .about-topbar").forEach((header) => {
  const toggle = header.querySelector(".mobile-product-nav-toggle");
  if (!toggle) return;

  toggle.addEventListener("click", () => {
    setProductNavigationState(header, !header.classList.contains("is-mobile-nav-open"));
  });

  toggle.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setProductNavigationState(header, false);
      toggle.focus();
    }
  });

  header.querySelectorAll(".mobile-product-nav a, .mobile-product-nav [data-auth-logout]").forEach((link) => {
    link.addEventListener("click", () => setProductNavigationState(header, false));
  });
});

syncProductNavigation();
if (mobileProductNavigation.addEventListener) {
  mobileProductNavigation.addEventListener("change", syncProductNavigation);
} else {
  mobileProductNavigation.addListener(syncProductNavigation);
}
