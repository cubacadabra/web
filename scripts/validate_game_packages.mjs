import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const rawArgs = process.argv.slice(2);
const traceMode = rawArgs[0] === "--trace";
const [bindingsPath, wasmPath, ...packagePaths] = traceMode ? rawArgs.slice(1) : rawArgs;
if (!bindingsPath || !wasmPath || packagePaths.length === 0) {
  console.error("usage: validate_game_packages.mjs [--trace] bindings.js runtime.wasm package...");
  process.exit(2);
}

const bindings = await import(pathToFileURL(path.resolve(bindingsPath)));
const exports = await bindings.default(await fs.readFile(wasmPath));

const traceInputs = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [1, 0.25, 1, 0, 0, 0.15, -0.1, 0],
  [-0.5, -1, 0, 1, 0, -0.2, 0.05, 0.1],
];

function sample(client, handle, actions) {
  const pointer = exports.engine_snapshot_ptr(handle);
  const length = exports.engine_snapshot_len();
  const words = Array.from(new Uint32Array(exports.memory.buffer, pointer, length));
  return {
    actions: JSON.parse(actions),
    snapshotWords: words,
  };
}

async function trace(packagePath) {
  const manifest = await fs.readFile(path.join(packagePath, "manifest.json"), "utf8");
  const script = await fs.readFile(path.join(packagePath, "game.luau"), "utf8");
  const client = new bindings.WebClient(manifest, script);
  const handle = client.engine_handle();
  if (!handle) throw new Error(`failed to load ${packagePath}`);
  const samples = [sample(client, handle, client.poll_actions_json())];
  for (const input of traceInputs) {
    exports.engine_set_input(handle, input[0], input[1], input[2], input[3], input[4], input[5], input[6], input[7]);
    exports.engine_step(handle, 0.016);
    samples.push(sample(client, handle, client.poll_actions_json()));
  }
  console.log(`CONFORMANCE_TRACE ${JSON.stringify(samples)}`);
  client.free();
}

for (const packagePath of packagePaths) {
  if (traceMode) {
    await trace(packagePath);
    continue;
  }
  const manifest = await fs.readFile(path.join(packagePath, "manifest.json"), "utf8");
  const script = await fs.readFile(path.join(packagePath, "game.luau"), "utf8");
  const client = new bindings.WebClient(manifest, script);
  if (!client.engine_handle()) throw new Error(`failed to load ${packagePath}`);
  client.free();
  console.log(`browser loaded ${packagePath}`);
}
