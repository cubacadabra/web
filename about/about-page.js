const ABOUT_ROUTE_TITLES = {
  overview: "Overview",
  "why-another-platform": "Why another platform?",
  opportunity: "The opportunity",
  "open-by-design": "Open by design",
  "hard-part": "The hard part",
  constituencies: "Three constituencies",
  "where-we-are": "Where we are now",
};

const normalizePath = (path) => {
  const normalized = path.replace(/\/+$/, "");
  return normalized || "/";
};

const routeFromPath = () => {
  const path = normalizePath(window.location.pathname);
  const aboutPrefix = "/about";
  const route = path.startsWith(`${aboutPrefix}/`)
    ? path.slice(`${aboutPrefix}/`.length)
    : "";
  return ABOUT_ROUTE_TITLES[route] ? route : "overview";
};

const setActiveMenuItem = (route) => {
  const currentPath = route === "overview" ? "/about" : `/about/${route}`;

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
  const title = ABOUT_ROUTE_TITLES[route];
  if (section && title && !section.querySelector(".about-route-breadcrumb")) {
    const breadcrumb = document.createElement("p");
    breadcrumb.className = "about-breadcrumb about-route-breadcrumb";
    breadcrumb.innerHTML = `<span>About</span><span aria-hidden="true">/</span><span>${title}</span>`;
    section.prepend(breadcrumb);
  }
};

const initializeAboutPage = (route) => {
  showRouteSection(route);
  setActiveMenuItem(route);
  document.body.dataset.aboutRoute = route;

  if (route !== "overview") {
    document.title = `${ABOUT_ROUTE_TITLES[route]} · About cubacadabra`;
  }
};

const loadRouteShell = async (route) => {
  const response = await fetch("/about/index.html");
  if (!response.ok) throw new Error(`About page unavailable: ${response.status}`);

  const source = await response.text();
  const parsed = new DOMParser().parseFromString(source, "text/html");
  document.body.innerHTML = parsed.body.innerHTML;
  document.body.className = "about-page";
  initializeAboutPage(route);
};

const route = routeFromPath();

if (document.querySelector(".about-shell")) initializeAboutPage(route);
else {
  loadRouteShell(route).catch(() => {
    document.body.innerHTML = "<main class=\"about-route-error\"><h1>About cubacadabra</h1><p>This page could not be loaded. Please try again.</p><a href=\"/about/\">Back to About</a></main>";
  });
}
