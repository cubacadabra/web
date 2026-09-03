import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: new URL("./index.html", import.meta.url).pathname,
        about: new URL("./about/index.html", import.meta.url).pathname,
        terms: new URL("./terms/index.html", import.meta.url).pathname,
        privacy: new URL("./privacy/index.html", import.meta.url).pathname,
      },
    },
  },
});
