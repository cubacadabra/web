import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GAME_ID_PATTERN } from "../src/game/gameId.js";

const project = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const examples = path.resolve(project, "../examples");
export const FEATURED_PROJECTS = ["cuboom", "first-game", "second-game"];

export async function featuredGameIds() {
  const ids = [];
  for (const name of FEATURED_PROJECTS) {
    const manifest = JSON.parse(await fs.readFile(path.join(examples, name, "manifest.json"), "utf8"));
    if (typeof manifest.id !== "string" || !GAME_ID_PATTERN.test(manifest.id) || ids.includes(manifest.id)) {
      throw new Error(`Invalid or duplicate featured package ID in ${name}`);
    }
    ids.push(manifest.id);
  }
  return ids;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const name of FEATURED_PROJECTS) console.log(path.join(examples, name));
}
