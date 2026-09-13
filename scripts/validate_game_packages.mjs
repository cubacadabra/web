import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [bindingsPath, wasmPath, ...packagePaths] = process.argv.slice(2);
if (!bindingsPath || !wasmPath || packagePaths.length === 0) {
  console.error("usage: validate_game_packages.mjs bindings.js runtime.wasm package...");
  process.exit(2);
}

const bindings = await import(pathToFileURL(path.resolve(bindingsPath)));
await bindings.default(await fs.readFile(wasmPath));

for (const packagePath of packagePaths) {
  const manifest = await fs.readFile(path.join(packagePath, "manifest.json"), "utf8");
  const script = await fs.readFile(path.join(packagePath, "game.luau"), "utf8");
  const client = new bindings.WebClient(manifest, script);
  if (!client.engine_handle()) throw new Error(`failed to load ${packagePath}`);
  client.free();
  console.log(`browser loaded ${packagePath}`);
}
