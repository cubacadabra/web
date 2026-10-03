import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const MAX_JSON_BYTES = 4_000_000;

async function checkSource(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isSymbolicLink() || entry.name === ".git") {
      throw new Error(`Unexpected deployment input: ${filename}`);
    }
    if (entry.isDirectory()) {
      await checkSource(filename);
    } else if (entry.name.endsWith(".json")) {
      const { size } = await fs.stat(filename);
      if (size > MAX_JSON_BYTES) {
        throw new Error(`${filename} is ${size} bytes; JSON must be at most ${MAX_JSON_BYTES} bytes. Redesign the generated output before publishing.`);
      }
    }
  }
}

export async function prepareDeployment(sourceDirectory, targetDirectory) {
  const source = await fs.realpath(sourceDirectory);
  const target = await fs.realpath(targetDirectory);
  if (source === target || source.startsWith(`${target}${path.sep}`) || target.startsWith(`${source}${path.sep}`)) {
    throw new Error("Build output and deployment checkout must be separate directories.");
  }
  await fs.access(path.join(source, "index.html"));
  await fs.access(path.join(source, "LICENSE"));
  await fs.access(path.join(source, "COPYRIGHT"));
  await checkSource(source);
  const git = (...args) => execFileSync("git", ["-C", target, ...args], { encoding: "utf8" }).trim();
  if (await fs.lstat(path.join(target, ".git")).then(() => false, () => true)) {
    throw new Error("The deployment target must be an existing Git checkout.");
  }
  if (git("status", "--porcelain", "--untracked-files=all")) {
    throw new Error("The deployment checkout has local changes. Review or save them before preparing another build.");
  }
  // Only replace tracked publication content. The checkout and its history
  // remain intact; all removals and additions are reviewable in git diff.
  for (const filename of execFileSync("git", ["-C", target, "ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean)) {
    await fs.rm(path.join(target, filename), { force: true });
  }
  await fs.cp(source, target, { recursive: true });
  return git("status", "--short");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const project = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  prepareDeployment(path.join(project, "dist"), path.join(project, "../deployed"))
    .then((status) => {
      console.log(status || "Deployment output is unchanged.");
      console.log("Prepared locally. Review the deployed checkout before committing and publishing it. No commit or push was performed.");
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
