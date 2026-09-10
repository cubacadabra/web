import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { WebApp, initSync } from "../public/wasm/app/cubacadabra_app.js";
import { AppRuntime } from "../src/app/AppRuntime.js";

initSync({ module: await readFile(new URL("../public/wasm/app/cubacadabra_app_bg.wasm", import.meta.url)) });
const scenarios = JSON.parse(await readFile(new URL("../../rust/crates/app/tests/username-contract.json", import.meta.url), "utf8"));

function assertSubset(actual, expected, label) {
  if (expected !== null && typeof expected === "object") {
    for (const [key, value] of Object.entries(expected)) assertSubset(actual[key], value, label + "." + key);
  } else assert.deepEqual(actual, expected, label);
}

for (const scenario of scenarios) {
  const model = new WebApp();
  for (const step of scenario.steps) {
    model.dispatch_json(JSON.stringify(step.action));
    assertSubset(JSON.parse(model.snapshot_json()), step.expected, scenario.name);
    const effects = [];
    for (let effect; (effect = model.poll_effect_json()) != null;) effects.push(JSON.parse(effect));
    assert.deepEqual(effects, step.effects, scenario.name);
  }
  assert.throws(() => model.dispatch_json('{"type":"username_changed","vale":"Ada"}'));
  assert.throws(() => model.dispatch_json('{"type":"save_username","typo":true}'));
  model.free();
}

// Exercise the production host adapter, not just the WASM state machine.
const requests = [];
const runtime = new AppRuntime(new WebApp(), (effect, signal) => new Promise((resolve) => {
  requests.push({ effect, signal, resolve });
}));
let hostUser = { id: "a", username: "Ada", body_id: "new-avatar", dob: "2000-01-01" };
runtime.subscribe((snapshot) => {
  if (snapshot.account_id === hostUser?.id) {
    hostUser = {
      ...hostUser,
      username: snapshot.profile.username,
      body_id: snapshot.profile.body_id,
      dob: snapshot.profile.date_of_birth,
    };
  }
});
await runtime.dispatch({ type: "replace_session", account_id: "a", username: "Ada", body_id: "cuba:person.v1", date_of_birth: "2000-01-01" });
await runtime.dispatch({ type: "username_changed", value: "  Grace  " });
const saving = runtime.dispatch({ type: "save_username" });
assert.equal(runtime.snapshot.profile.username_is_saving, true);
await runtime.dispatch({ type: "save_username" });
assert.equal(requests.length, 1);
assert.equal(requests[0].effect.path, "auth/username");
assert.deepEqual(JSON.parse(requests[0].effect.body), { username: "Grace" });
assert.equal(hostUser.username, "Ada"); // HTTP has not been accepted yet.
requests[0].resolve({ status: 200, body: '{"user":{"id":"a","username":"Grace","body_id":"old-avatar"}}' });
await saving;
assert.deepEqual(hostUser, { id: "a", username: "Grace", body_id: "cuba:person.v1", dob: "2000-01-01" });

await runtime.dispatch({ type: "body_changed", body_id: "cuba:person-girl.v1" });
const bodySaving = runtime.dispatch({ type: "save_body" });
assert.equal(runtime.snapshot.profile.body_is_saving, true);
assert.equal(requests[1].effect.path, "auth/avatar");
assert.deepEqual(JSON.parse(requests[1].effect.body), { body_id: "cuba:person-girl.v1" });
requests[1].resolve({ status: 200, body: '{"user":{"id":"a","body_id":"cuba:person-girl.v1"}}' });
await bodySaving;
assert.equal(hostUser.body_id, "cuba:person-girl.v1");

const birthdaySaving = runtime.dispatch({ type: "save_birthday", date_of_birth: "2001-02-03" });
assert.equal(runtime.snapshot.profile.birthday_is_saving, true);
assert.equal(requests[2].effect.path, "auth/birthday");
assert.deepEqual(JSON.parse(requests[2].effect.body), { dob: "2001-02-03" });
requests[2].resolve({ status: 200, body: '{"user":{"id":"a","dob":"2001-02-03"},"age":25}' });
await birthdaySaving;
assert.equal(hostUser.dob, "2001-02-03");

const catalogLoading = runtime.dispatch({ type: "load_catalog", page_size: 20 });
assert.equal(requests[3].effect.method, "GET");
assert.equal(requests[3].effect.path, "cubes?page=1&page_size=20");
assert.equal(requests[3].effect.body, "");
requests[3].resolve({
  status: 200,
  body: JSON.stringify({ page: 1, hasNextPage: true, cubes: [{
    id: 1,
    cubeId: "uploaded-cube",
    version: "1.2.3",
    displayName: "Uploaded Cube",
    fileCount: 1,
    packagePath: "/cubes/1/files/",
  }] }),
});
await catalogLoading;
const catalogNextPage = runtime.dispatch({ type: "load_catalog", page: 2, page_size: 20 });
assert.equal(requests[4].effect.path, "cubes?page=2&page_size=20");
requests[4].resolve({
  status: 200,
  body: JSON.stringify({ page: 2, hasNextPage: false, cubes: [{
    id: 2,
    cubeId: "second-uploaded-cube",
    version: "1.0.0",
    displayName: "Second Uploaded Cube",
    fileCount: 1,
    packagePath: "/cubes/2/files/",
  }] }),
});
await catalogNextPage;
assert.deepEqual(runtime.snapshot.catalog.entries, [{
  cube_id: "uploaded-cube",
  version: "1.2.3",
  display_name: "Uploaded Cube",
  package_path: "/cubes/1/files/",
  asset_base_url: null,
}, {
  cube_id: "second-uploaded-cube",
  version: "1.0.0",
  display_name: "Second Uploaded Cube",
  package_path: "/cubes/2/files/",
  asset_base_url: null,
}]);

const blockedLoading = runtime.dispatch({ type: "load_blocked_users" });
assert.equal(requests[5].effect.method, "GET");
assert.equal(requests[5].effect.path, "moderation/blocks");
requests[5].resolve({
  status: 200,
  body: JSON.stringify({ ok: true, user_ids: ["user-1", "user-2", "user-1"] }),
});
await blockedLoading;
assert.deepEqual(runtime.snapshot.safety.blocked_user_ids, ["user-1", "user-2"]);

const unblock = runtime.dispatch({ type: "unblock_user", user_id: "user-2" });
assert.equal(requests[6].effect.method, "DELETE");
assert.equal(requests[6].effect.path, "moderation/blocks/user-2");
assert.deepEqual(runtime.snapshot.safety.blocked_user_ids, ["user-1"]);
requests[6].resolve({ status: 200, body: '{"ok":true}' });
await unblock;
assert.deepEqual(runtime.snapshot.safety.blocked_user_ids, ["user-1"]);

await runtime.dispatch({ type: "username_changed", value: "Later" });
const staleSave = runtime.dispatch({ type: "save_username" });
await runtime.dispatch({ type: "replace_session", account_id: null, username: null });
assert.equal(requests[7].signal.aborted, true);
hostUser = { id: "b", username: "Lin", dob: null };
await runtime.dispatch({ type: "replace_session", account_id: "b", username: "Lin", date_of_birth: null });
requests[7].resolve({ status: 200, body: '{"user":{"id":"a","username":"Later"}}' });
await staleSave;
assert.equal(hostUser.username, "Lin");
assert.equal(runtime.snapshot.profile.username_is_saving, false);

await runtime.dispatch({ type: "username_changed", value: "Final" });
const closingSave = runtime.dispatch({ type: "save_username" });
runtime.close();
runtime.close();
assert.equal(requests[8].signal.aborted, true);
requests[8].resolve({ status: 200, body: '{"user":{"id":"b","username":"Final"}}' });
await closingSave; // No callback touches the freed WASM handle.
assert.equal(hostUser.username, "Lin");
assert.throws(() => runtime.dispatch({ type: "save_username" }), /closed/);
console.log(`Passed ${scenarios.length} shared WASM scenarios and host lifecycle checks.`);
