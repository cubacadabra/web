// Feature-independent WASM adapter. No account rules or API codecs belong here.
export class AppRuntime {
  constructor(model, request) {
    this.model = model;
    this.request = request;
    this.listeners = new Set();
    this.requests = new Map();
    this.closed = false;
    this.readSnapshot();
  }

  readSnapshot() {
    const value = JSON.parse(this.model.snapshot_json());
    const p = value.profile;
    const catalog = value.catalog;
    if (value.protocol_version !== 1 || !Number.isInteger(value.session_id)
      || !(value.account_id === null || typeof value.account_id === "string")
      || !p || !(p.username === null || typeof p.username === "string")
      || typeof p.username_draft !== "string"
      || !["username_is_dirty", "username_can_save", "username_is_saving"].every((key) => typeof p[key] === "boolean")
      || !(p.username_validation_error === null || typeof p.username_validation_error === "string")
      || !(p.username_feedback === null || (["success", "error"].includes(p.username_feedback?.kind)
        && typeof p.username_feedback.message === "string"))
      || !(p.body_id === null || typeof p.body_id === "string")
      || typeof p.body_draft !== "string"
      || !["body_can_save", "body_is_saving"].every((key) => typeof p[key] === "boolean")
      || !(p.body_feedback === null || (["success", "error"].includes(p.body_feedback?.kind)
        && typeof p.body_feedback.message === "string"))
      || !(p.date_of_birth === null || typeof p.date_of_birth === "string")
      || typeof p.birthday_is_saving !== "boolean"
      || !(p.birthday_feedback === null || (["success", "error"].includes(p.birthday_feedback?.kind)
        && typeof p.birthday_feedback.code === "string"
        && typeof p.birthday_feedback.message === "string"))) {
      throw new Error("Unsupported app snapshot");
    }
    if (!catalog || !Array.isArray(catalog.entries) || !Number.isInteger(catalog.page)
      || typeof catalog.has_next_page !== "boolean" || typeof catalog.is_loading !== "boolean"
      || !(catalog.feedback === null || (catalog.feedback.kind === "error"
        && typeof catalog.feedback.code === "string"
        && typeof catalog.feedback.message === "string"))
      || catalog.entries.some((entry) => !entry
        || typeof entry.cube_id !== "string"
        || typeof entry.version !== "string"
        || typeof entry.display_name !== "string"
        || typeof entry.package_path !== "string"
        || !(entry.asset_base_url === null || typeof entry.asset_base_url === "string"))) {
      throw new Error("Unsupported app snapshot");
    }
    this.snapshot = value;
    for (const listener of this.listeners) listener(value);
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  dispatch(action) {
    if (this.closed) throw new Error("App runtime is closed");
    this.model.dispatch_json(JSON.stringify(action));
    if (action.type === "replace_session") {
      for (const controller of this.requests.values()) controller.abort();
      this.requests.clear();
    }
    this.readSnapshot();
    const pending = [];
    for (let source; (source = this.model.poll_effect_json()) != null;) {
      const effect = JSON.parse(source);
      if (effect.type !== "http_request" || !Number.isInteger(effect.effect_id)
        || !(effect.account_id === null || typeof effect.account_id === "string")
        || !["method", "path", "body"].every((key) => typeof effect[key] === "string")) {
        throw new Error("Unsupported app effect");
      }
      pending.push(this.perform(effect));
    }
    return Promise.all(pending).then(() => this.snapshot);
  }

  async perform(effect) {
    const controller = new AbortController();
    this.requests.set(effect.effect_id, controller);
    let action;
    try {
      if (effect.account_id !== null && effect.account_id !== this.snapshot.account_id) {
        throw new Error("Replaced account");
      }
      // Start transport now: do not defer credential selection to a later session.
      const response = await this.request(effect, controller.signal);
      action = { type: "http_completed", effect_id: effect.effect_id, status: response.status, body: response.body };
    } catch {
      action = { type: "http_failed", effect_id: effect.effect_id };
    } finally {
      this.requests.delete(effect.effect_id);
    }
    if (!this.closed) await this.dispatch(action);
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    for (const controller of this.requests.values()) controller.abort();
    this.requests.clear();
    this.listeners.clear();
    this.model.free();
  }
}
