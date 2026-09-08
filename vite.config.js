import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { ABOUT_ROUTES } from "./about/about-routes.js";
import { buildAboutPages } from "./scripts/build-about-pages.js";

const projectPath = (relativePath) => new URL(`./${relativePath}`, import.meta.url).pathname;
const projectDirectory = path.dirname(fileURLToPath(import.meta.url));
const aboutRoutes = Object.entries(ABOUT_ROUTES).filter(([routeId]) => routeId !== "overview");
const generatedPagesDirectory = path.join(
  projectDirectory,
  "node_modules/.cache/cubacadabra-pages",
);
await fs.rm(generatedPagesDirectory, { recursive: true, force: true });
await fs.mkdir(generatedPagesDirectory, { recursive: true });
await buildAboutPages({ outputDirectory: generatedPagesDirectory });

const generatedPagePath = (routePath) => path.join(
  generatedPagesDirectory,
  routePath.slice(1),
  "index.html",
);
const aboutInputs = Object.fromEntries(
  aboutRoutes.map(([routeId, route]) => [
    `about_${routeId.replaceAll("-", "_")}`,
    generatedPagePath(route.path),
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

const generatedPageServer = () => ({
  name: "generated-page-server",
  configureServer(server) {
    server.middlewares.use(async (request, response, next) => {
      const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
      const pagePath = pathname.endsWith("/") ? pathname : pathname + "/";
      const generatedPath = pagePath === "/my-cube/"
        ? generatedPagePath("/my-cube/")
        : aboutRoutes.some(([, route]) => route.path === pagePath)
          ? generatedPagePath(pagePath)
          : null;

      if (!generatedPath) {
        next();
        return;
      }

      try {
        const source = await fs.readFile(generatedPath, "utf8");
        const html = await server.transformIndexHtml(pathname, source);
        response.statusCode = 200;
        response.setHeader("Content-Type", "text/html");
        response.end(html);
      } catch (error) {
        next(error);
      }
    });
  },
});

export default defineConfig({
  plugins: [aboutRouteRedirect(), generatedPageServer()],
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
        myCube: generatedPagePath("/my-cube/"),
      },
    },
  },
});
