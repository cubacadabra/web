import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ABOUT_ROUTES } from "../about/about-routes.js";

const projectDirectory = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const distDirectory = path.join(projectDirectory, "dist");
const generatedDirectory = path.join(distDirectory, "node_modules/.cache/cubacadabra-pages");

const movePage = async (routePath) => {
  const sourcePath = path.join(generatedDirectory, routePath.slice(1), "index.html");
  const destinationPath = path.join(distDirectory, routePath.slice(1), "index.html");

  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  await fs.rename(sourcePath, destinationPath);
};

const normalize = async () => {
  const generatedRoutes = Object.values(ABOUT_ROUTES)
    .filter((route) => route.path !== "/about/")
    .map((route) => route.path);

  await Promise.all([...generatedRoutes, "/my-cube/"].map(movePage));
  await fs.rm(path.join(distDirectory, "node_modules"), { recursive: true, force: true });
  await fs.copyFile(
    path.join(distDirectory, "index.html"),
    path.join(distDirectory, "404.html"),
  );
};

normalize().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
