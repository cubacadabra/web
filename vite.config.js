import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { buildSitePages } from "./scripts/build-site-pages.js";
import { SITE_PAGES } from "./site/site-routes.js";

const projectDirectory = path.dirname(fileURLToPath(import.meta.url));
const generatedPagesDirectory = path.join(
  projectDirectory,
  "node_modules/.cache/cubacadabra-site",
);

await fs.rm(generatedPagesDirectory, { recursive: true, force: true });
await fs.mkdir(generatedPagesDirectory, { recursive: true });
await buildSitePages({ outputDirectory: generatedPagesDirectory });

const generatedPagePath = (routePath) => routePath === "/"
  ? path.join(generatedPagesDirectory, "index.html")
  : path.join(generatedPagesDirectory, routePath.slice(1), "index.html");

const pagesByPath = new Map(SITE_PAGES.map((page) => [page.path, page]));
const routesWithoutTrailingSlash = new Set(
  SITE_PAGES
    .map((page) => page.path)
    .filter((routePath) => routePath !== "/")
    .map((routePath) => routePath.replace(/\/$/, "")),
);

const sitePageServer = () => ({
  name: "site-page-server",
  configureServer(server) {
    server.middlewares.use(async (request, response, next) => {
      const pathname = new URL(request.url ?? "/", "http://localhost").pathname;

      if (routesWithoutTrailingSlash.has(pathname)) {
        response.statusCode = 308;
        response.setHeader("Location", `${pathname}/`);
        response.end();
        return;
      }

      if (pathname === "/sitemap.xml") {
        try {
          await buildSitePages({ outputDirectory: generatedPagesDirectory });
          const sitemap = await fs.readFile(
            path.join(generatedPagesDirectory, "sitemap.xml"),
            "utf8",
          );
          response.statusCode = 200;
          response.setHeader("Content-Type", "application/xml; charset=utf-8");
          response.end(sitemap);
        } catch (error) {
          next(error);
        }
        return;
      }

      const page = pagesByPath.get(pathname);
      if (!page) {
        next();
        return;
      }

      try {
        await buildSitePages({ outputDirectory: generatedPagesDirectory });
        const source = await fs.readFile(generatedPagePath(page.path), "utf8");
        const html = await server.transformIndexHtml(pathname, source);
        response.statusCode = 200;
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.end(html);
      } catch (error) {
        next(error);
      }
    });
  },
  configurePreviewServer(server) {
    server.middlewares.use((request, response, next) => {
      const pathname = request.url?.split("?")[0];
      if (!routesWithoutTrailingSlash.has(pathname)) {
        next();
        return;
      }

      response.statusCode = 308;
      response.setHeader("Location", `${pathname}/`);
      response.end();
    });
  },
});

const pageInputs = Object.fromEntries(
  SITE_PAGES.map((page) => [page.id, generatedPagePath(page.path)]),
);

export default defineConfig({
  plugins: [sitePageServer()],
  build: {
    rollupOptions: {
      input: pageInputs,
    },
  },
});
