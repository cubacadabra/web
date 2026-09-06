import { defineConfig } from "vite";
import { ABOUT_ROUTES } from "./about/about-routes.js";

const projectPath = (relativePath) => new URL(`./${relativePath}`, import.meta.url).pathname;
const aboutRoutes = Object.entries(ABOUT_ROUTES).filter(([routeId]) => routeId !== "overview");
const aboutInputs = Object.fromEntries(
  aboutRoutes.map(([routeId, route]) => [
    `about_${routeId.replaceAll("-", "_")}`,
    projectPath(`${route.path.slice(1)}index.html`),
  ]),
);

const siteRoutes = [
  ...aboutRoutes.map(([, route]) => route.path.replace(/\/$/, "")),
  "/download",
  "/download/android",
  "/my-cube",
];

const trailingSlashRedirect = (request, response, next) => {
  const pathname = request.url?.split("?")[0];
  if (siteRoutes.includes(pathname)) {
    response.statusCode = 308;
    response.setHeader("Location", `${pathname}/`);
    response.end();
    return;
  }
  next();
};

const aboutRouteRedirect = () => ({
  name: "about-route-redirect",
  configureServer(server) {
    server.middlewares.use(trailingSlashRedirect);
  },
  configurePreviewServer(server) {
    server.middlewares.use(trailingSlashRedirect);
  },
});

export default defineConfig({
  plugins: [aboutRouteRedirect()],
  build: {
    rollupOptions: {
      input: {
        main: projectPath("index.html"),
        about: projectPath("about/index.html"),
        ...aboutInputs,
        download: projectPath("download/index.html"),
        downloadAndroid: projectPath("download/android/index.html"),
        terms: projectPath("terms/index.html"),
        privacy: projectPath("privacy/index.html"),
        login: projectPath("login/index.html"),
        myCube: projectPath("my-cube/index.html"),
      },
    },
  },
});
