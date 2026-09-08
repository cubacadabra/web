import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSitemap } from "./build-site-pages.js";
import { SITE, SITE_PAGES } from "../site/site-routes.js";

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
  await Promise.all(SITE_PAGES.map(movePage));
  await fs.rm(path.join(distDirectory, "node_modules"), { recursive: true, force: true });
  await fs.copyFile(
    path.join(distDirectory, "index.html"),
    path.join(distDirectory, "404.html"),
  );
  await Promise.all([
    fs.writeFile(path.join(distDirectory, "sitemap.xml"), createSitemap()),
    fs.writeFile(path.join(distDirectory, "CNAME"), `${new URL(SITE.origin).hostname}\n`),
    fs.writeFile(path.join(distDirectory, "README.md"), "# deployed\n"),
    fs.writeFile(path.join(distDirectory, ".nojekyll"), ""),
  ]);
};

normalize().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
