import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { prepareDeployment } from "./prepare-deployment.js";

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cuba-deploy-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const source = path.join(root, "dist");
  const target = path.join(root, "deployed");
  await fs.mkdir(source);
  await fs.mkdir(target);
  for (const name of ["index.html", "LICENSE", "COPYRIGHT"]) {
    await fs.writeFile(path.join(source, name), `new ${name}\n`);
  }
  const git = (...args) => execFileSync("git", ["-C", target, ...args], { encoding: "utf8" }).trim();
  git("init", "--quiet");
  await fs.writeFile(path.join(target, "old.html"), "old output\n");
  git("add", ".");
  git("-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "--quiet", "-m", "fixture");
  return { source, target, git };
}

test("preparation replaces publication files without changing Git history", async (t) => {
  const { source, target, git } = await fixture(t);
  const head = git("rev-parse", "HEAD");
  const status = await prepareDeployment(source, target);
  assert.equal(git("rev-parse", "HEAD"), head);
  assert.match(status, /D old.html/);
  assert.equal(await fs.readFile(path.join(target, "index.html"), "utf8"), "new index.html\n");
});

test("dirty checkout is preserved", async (t) => {
  const { source, target } = await fixture(t);
  await fs.writeFile(path.join(target, "old.html"), "user changes\n");
  await assert.rejects(prepareDeployment(source, target), /local changes/);
  assert.equal(await fs.readFile(path.join(target, "old.html"), "utf8"), "user changes\n");
});

test("oversized generated JSON fails before the checkout is changed", async (t) => {
  const { source, target, git } = await fixture(t);
  await fs.writeFile(path.join(source, "manifest.json"), " ".repeat(4_000_001));
  await assert.rejects(prepareDeployment(source, target), /4000001 bytes/);
  assert.equal(git("status", "--porcelain"), "");
  assert.equal(await fs.readFile(path.join(target, "old.html"), "utf8"), "old output\n");
});
