import { defineConfig } from "vite";

const aboutRoutes = [
  "why-another-platform",
  "opportunity",
  "open-by-design",
  "hard-part",
  "constituencies",
  "where-we-are",
];

const aboutRouteRedirect = () => ({
  name: "about-route-redirect",
  configureServer(server) {
    server.middlewares.use((request, response, next) => {
      const pathname = request.url?.split("?")[0];
      if (aboutRoutes.some((route) => pathname === `/about/${route}`)) {
        response.statusCode = 308;
        response.setHeader("Location", `${pathname}/`);
        response.end();
        return;
      }
      next();
    });
  },
  configurePreviewServer(server) {
    server.middlewares.use((request, response, next) => {
      const pathname = request.url?.split("?")[0];
      if (aboutRoutes.some((route) => pathname === `/about/${route}`)) {
        response.statusCode = 308;
        response.setHeader("Location", `${pathname}/`);
        response.end();
        return;
      }
      next();
    });
  },
});

export default defineConfig({
  plugins: [aboutRouteRedirect()],
  build: {
    rollupOptions: {
      input: {
        main: new URL("./index.html", import.meta.url).pathname,
        about: new URL("./about/index.html", import.meta.url).pathname,
        aboutWhyAnotherPlatform: new URL("./about/why-another-platform/index.html", import.meta.url).pathname,
        aboutOpportunity: new URL("./about/opportunity/index.html", import.meta.url).pathname,
        aboutOpenByDesign: new URL("./about/open-by-design/index.html", import.meta.url).pathname,
        aboutHardPart: new URL("./about/hard-part/index.html", import.meta.url).pathname,
        aboutConstituencies: new URL("./about/constituencies/index.html", import.meta.url).pathname,
        aboutWhereWeAre: new URL("./about/where-we-are/index.html", import.meta.url).pathname,
        terms: new URL("./terms/index.html", import.meta.url).pathname,
        privacy: new URL("./privacy/index.html", import.meta.url).pathname,
      },
    },
  },
});
