import { ABOUT_ROUTES } from "./about-routes.js";

const normalizePath = (path) => {
  const normalized = path.replace(/\/+$/, "");
  return normalized || "/";
};

const routeFromPath = () => {
  const path = normalizePath(window.location.pathname);
  return Object.entries(ABOUT_ROUTES).find(([, route]) => normalizePath(route.path) === path)?.[0] || "overview";
};

const setActiveMenuItem = (route) => {
  const currentPath = normalizePath(ABOUT_ROUTES[route].path);

  document.querySelectorAll(".about-menu a").forEach((link) => {
    const isCurrent = normalizePath(new URL(link.href).pathname) === currentPath;
    link.classList.toggle("is-active", isCurrent);
    if (isCurrent) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
};

const showRouteSection = (route) => {
  const overview = document.querySelector(".about-overview");
  const sections = [...document.querySelectorAll(".about-section")];

  if (route === "overview") {
    sections.forEach((section) => section.remove());
    return;
  }

  overview?.remove();
  sections
    .filter((section) => section.id !== route)
    .forEach((section) => section.remove());

  const section = document.getElementById(route);
  const title = ABOUT_ROUTES[route].title;
  const content = document.querySelector(".about-content");
  if (content && section && title && !content.querySelector(".about-route-breadcrumb")) {
    const breadcrumb = document.createElement("p");
    breadcrumb.className = "about-breadcrumb about-route-breadcrumb";
    breadcrumb.innerHTML = `<span>About</span><span aria-hidden="true">/</span><span>${title}</span>`;
    content.insertBefore(breadcrumb, section);
  }
};

const initializeAboutPage = (route) => {
  showRouteSection(route);
  setActiveMenuItem(route);
  document.body.dataset.aboutRoute = route;

  if (route !== "overview") {
    document.title = ABOUT_ROUTES[route].pageTitle || `${ABOUT_ROUTES[route].title} · About cubacadabra`;
  }
};

const route = routeFromPath();

if (document.querySelector(".about-shell")) initializeAboutPage(route);
