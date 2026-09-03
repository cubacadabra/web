const ABOUT_ROUTES = {
  overview: { title: "Overview", path: "/about/" },
  "open-source-web": { title: "web", path: "/about/open-source/web/" },
  "open-source-rust": { title: "rust", path: "/about/open-source/rust/" },
  "open-source-ios-app": { title: "ios_app", path: "/about/open-source/ios-app/" },
  "open-source-android-app": { title: "android_app", path: "/about/open-source/android-app/" },
  "open-source-first-game": { title: "first_game", path: "/about/open-source/first-game/" },
  "why-another-platform": { title: "Why another platform?", path: "/about/why-another-platform/" },
  opportunity: { title: "The opportunity", path: "/about/opportunity/" },
  "open-by-design": { title: "Open by design", path: "/about/open-by-design/" },
  "hard-part": { title: "The hard part", path: "/about/hard-part/" },
  constituencies: { title: "Three constituencies", path: "/about/constituencies/" },
  "where-we-are": { title: "Where we are now", path: "/about/where-we-are/" },
};

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
    document.title = `${ABOUT_ROUTES[route].title} · About cubacadabra`;
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
