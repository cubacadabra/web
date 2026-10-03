import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSitemap } from "./build-site-pages.js";
import { SITE, SITE_PAGES } from "../site/site-routes.js";
import { featuredGameIds } from "./featured-games.js";

const projectDirectory = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const distDirectory = path.join(projectDirectory, "dist");
const generatedDirectory = path.join(distDirectory, "node_modules/.cache/cubacadabra-site");

const pagePath = (directory, routePath) => routePath === "/"
  ? path.join(directory, "index.html")
  : path.join(directory, routePath.slice(1), "index.html");

const movePage = async (page) => {
  const sourcePath = pagePath(generatedDirectory, page.path);
  const destinationPath = pagePath(distDirectory, page.path);

  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  await fs.rename(sourcePath, destinationPath);
};

const normalize = async () => {
  const fontSources = path.join(projectDirectory, "../rust/assets/fonts");
  const notices = path.join(distDirectory, "licenses");
  await fs.mkdir(notices, { recursive: true });
  for (const filename of await fs.readdir(fontSources)) {
    if (filename.endsWith("-OFL.txt")) {
      await fs.copyFile(path.join(fontSources, filename), path.join(notices, filename));
    }
  }
  if (process.argv.includes("--featured")) {
    const featured = new Set(await featuredGameIds());
    const games = path.join(distDirectory, "games");
    for (const entry of await fs.readdir(games, { withFileTypes: true })) {
      if (entry.isDirectory() && !featured.has(entry.name)) {
        await fs.rm(path.join(games, entry.name), { recursive: true });
      }
    }
  }
  await Promise.all(SITE_PAGES.map(movePage));
  await fs.rm(path.join(distDirectory, "node_modules"), { recursive: true, force: true });
  await fs.copyFile(
    path.join(distDirectory, "cube/index.html"),
    path.join(distDirectory, "404.html"),
  );
  await Promise.all([
    fs.writeFile(path.join(distDirectory, "sitemap.xml"), createSitemap()),
    fs.writeFile(path.join(distDirectory, "CNAME"), `${new URL(SITE.origin).hostname}\n`),
    fs.writeFile(path.join(distDirectory, "README.md"),
      "# Cubacadabra published Web output\n\n" +
      "Generated from [cubacadabra/web](https://github.com/cubacadabra/web). " +
      "Edit the source repository and rebuild; do not hand-edit runtime packages or hashed assets.\n\n" +
      "Platform source is GPL-3.0-or-later; see LICENSE and COPYRIGHT. " +
      "Third-party assets retain their accompanying notices; embedded runtime font notices are in licenses/. " +
      "Start with [Cuboom](https://github.com/cubacadabra/examples/tree/main/cuboom) " +
      "and [the canonical docs](https://github.com/cubacadabra/docs).\n"),
    fs.copyFile(path.join(projectDirectory, "LICENSE"), path.join(distDirectory, "LICENSE")),
    fs.copyFile(path.join(projectDirectory, "COPYRIGHT"), path.join(distDirectory, "COPYRIGHT")),
    fs.writeFile(path.join(distDirectory, ".nojekyll"), ""),
  ]);
};

normalize().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
