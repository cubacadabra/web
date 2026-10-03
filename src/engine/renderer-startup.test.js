import assert from "node:assert/strict";
import test from "node:test";
import { initializeRenderer } from "./renderer-startup.js";

test("successful startup keeps the live renderer", async () => {
  let freed = false;
  const result = { renderer: { free() { freed = true; } } };
  assert.equal(await initializeRenderer(() => result), result);
  assert.equal(freed, false);
});

test("startup failures preserve the original error", async () => {
  const failure = new Error("No compatible adapter");
  await assert.rejects(initializeRenderer(() => Promise.reject(failure)), (error) => error === failure);
});

test("a stalled device fails promptly and is freed if it arrives later", async () => {
  let complete;
  let freeCount = 0;
  const pending = new Promise((resolve) => { complete = resolve; });
  await assert.rejects(initializeRenderer(() => pending, 5), { name: "RendererStartupTimeout" });
  complete({ renderer: { free() { freeCount += 1; } } });
  await new Promise(setImmediate);
  assert.equal(freeCount, 1);
});

test("a late device rejection is handled after the timeout", async () => {
  let fail;
  const pending = new Promise((_, reject) => { fail = reject; });
  await assert.rejects(initializeRenderer(() => pending, 5), { name: "RendererStartupTimeout" });
  fail(new Error("Adapter rejected later"));
  await new Promise(setImmediate);
});
