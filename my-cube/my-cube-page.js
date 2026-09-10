import { initializeAccountRuntime, clearAccountSession } from "../src/app/accountRuntime.js";
import { getCurrentUser, initializeLogoutButton } from "../src/auth/session.js";
import { backendApiUrl } from "../src/config/clientConfig.js";
import { mountStripeEmbeddedCheckout } from "../src/payments/stripeEmbeddedCheckout.js";

const loginPath = `/login/?returnTo=${encodeURIComponent(`${window.location.pathname}${window.location.search}${window.location.hash}`)}`;
const content = document.querySelector(".about-content");
const menuLinks = [...document.querySelectorAll(".about-menu > a")];
const sidebarStatus = document.querySelector(".about-sidebar-status");
const DEFAULT_BODY_ID = "cuba:person.v1";
const AVATAR_OPTIONS = [
  { bodyId: DEFAULT_BODY_ID, label: "Boy", image: "/images/player_boy_001.png" },
  { bodyId: "cuba:person-girl.v1", label: "Girl", image: "/images/player_girl_001.png" },
  { bodyId: "cuba:person-nb.v1", label: "Nonbinary", image: "/images/player_nb_001.png" },
];
const BLOCKED_USERS_PATH = "/moderation/blocks";
const SUBSCRIPTION_PATH = "/subscription";
const CUBE_UPLOAD_PATH = "/cubes/upload";
const MAX_CUBE_ZIP_BYTES = 25 * 1024 * 1024;
let currentUser = null;
let accountReady;
let basicsCleanup;
let subscriptionCheckoutCleanup = null;

function calculateAge(dob) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob || "")) return null;
  const [year, month, day] = dob.split("-").map(Number);
  const now = new Date();
  let age = now.getFullYear() - year;
  const birthdayHasPassed = now.getMonth() + 1 > month
    || (now.getMonth() + 1 === month && now.getDate() >= day);
  if (!birthdayHasPassed) age -= 1;
  return age;
}

function setMenuState(requiresBirthday, activeSection = requiresBirthday ? "birthday" : "basics") {
  basicsCleanup?.();
  basicsCleanup = null;
  const firstLink = menuLinks[0];
  if (firstLink) {
    firstLink.href = requiresBirthday ? "#birthday" : "#item1";
    firstLink.querySelector("span").textContent = requiresBirthday ? "Birthday" : "Basics";
    firstLink.dataset.section = requiresBirthday ? "birthday" : "basics";
  }

  menuLinks.slice(1).forEach((link) => {
    link.hidden = requiresBirthday && link.dataset.section !== "upload-cube";
  });

  menuLinks.forEach((link) => {
    const isActive = !link.hidden && link.dataset.section === activeSection;
    link.classList.toggle("is-active", isActive);
    if (isActive) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });

  if (sidebarStatus) {
    sidebarStatus.textContent = requiresBirthday ? "Required to continue" : "";
  }
}

function setFormStatus(statusElement, message, state = "") {
  statusElement.textContent = message;
  statusElement.dataset.state = state;
}

function birthdayFormMarkup() {
  return `
    <div class="birthday-view" id="birthday">
      <div class="birthday-intro">
        <p class="about-label">One important detail</p>
        <h1 id="birthday-title">Tell us when you were born.</h1>
        <p class="about-lede">Your birthday helps us create the right, safer experience for your age.</p>
      </div>

      <div class="birthday-workspace">
        <section class="birthday-guidance" aria-labelledby="birthday-guidance-title">
          <p class="birthday-kicker">A safer world for everyone</p>
          <h2 id="birthday-guidance-title">Real age, real protections.</h2>
          <p>cubacadabra takes COPPA and child safety seriously, so we need your real age to apply the right safeguards.</p>
          <p>If you’re a kid, please don’t lie about your age. If you follow the rules, tell us your real birthday, and have a parent sign up too, you can have a fun, safe experience—and your parent will know which cubes you’re using.</p>
        </section>

        <form class="birthday-form" novalidate>
          <div class="birthday-form-heading">
            <p class="birthday-kicker">Your birthday</p>
            <p>Use the date on your official records. No time or location is needed.</p>
          </div>
          <div class="birthday-fields" role="group" aria-labelledby="birthday-fields-label">
            <span class="sr-only" id="birthday-fields-label">Birthday date</span>
            <label class="birthday-field birthday-field-year">
              <span>Year</span>
              <input name="year" type="text" inputmode="numeric" autocomplete="bday-year" maxlength="4" pattern="[0-9]{4}" placeholder="YYYY" autofocus required />
            </label>
            <label class="birthday-field">
              <span>Month</span>
              <input name="month" type="text" inputmode="numeric" autocomplete="bday-month" maxlength="2" pattern="[0-9]{1,2}" placeholder="MM" required />
            </label>
            <label class="birthday-field">
              <span>Day</span>
              <input name="day" type="text" inputmode="numeric" autocomplete="bday-day" maxlength="2" pattern="[0-9]{1,2}" placeholder="DD" required />
            </label>
          </div>
          <p class="birthday-form-note">Please enter a complete, valid calendar date.</p>
          <p class="birthday-status" role="alert" aria-live="polite"></p>
          <button class="birthday-submit" type="submit">Save birthday</button>
        </form>
      </div>
    </div>`;
}

function parentStepMarkup() {
  return `
    <div class="birthday-view birthday-view-parent" id="birthday">
      <div class="birthday-intro">
        <p class="about-label">A parent or guardian is next</p>
        <h1 id="parent-title">Let’s bring a parent in.</h1>
        <p class="about-lede">Thanks for sharing your real birthday. Because you’re under 13, we need a parent’s email before you can continue.</p>
      </div>

      <div class="birthday-workspace birthday-workspace-parent">
        <section class="birthday-guidance" aria-labelledby="parent-guidance-title">
          <p class="birthday-kicker">Why we ask</p>
          <h2 id="parent-guidance-title">Safety works better together.</h2>
          <p>Ask your parent or guardian to sign up with you. They’ll be able to know which cubes you’re using while you enjoy a fun, safe experience.</p>
          <p class="birthday-parent-note">Please ask a parent or guardian for permission before entering their email.</p>
        </section>

        <form class="birthday-form parent-email-form" novalidate>
          <div class="birthday-form-heading">
            <p class="birthday-kicker">Parent or guardian email</p>
            <p>We’ll use this to start the parent sign-up step.</p>
          </div>
          <label class="parent-email-field">
            <span>Email address</span>
            <input id="parent-email" name="parent-email" type="email" autocomplete="email" placeholder="parent@example.com" required autofocus />
          </label>
          <p class="birthday-status" role="status" aria-live="polite"></p>
          <button class="birthday-submit" type="submit">Continue with a parent</button>
        </form>
      </div>
    </div>`;
}

function basicsMarkup() {
  const avatarOptions = AVATAR_OPTIONS.map((option) => `
            <label class="basics-avatar-option">
              <input type="radio" name="body_id" value="${option.bodyId}" />
              <span class="basics-avatar-option-content">
                <img src="${option.image}" alt="${option.label} avatar" />
                <span>${option.label}</span>
              </span>
            </label>`).join("");

  return `
    <div class="basics-view" id="item1">
      <div class="basics-workspace">
        <form class="basics-form" novalidate autocomplete="off">
          <label class="basics-field" for="my-cube-username">
            <span>Username</span>
            <input id="my-cube-username" name="username" type="text" autocomplete="nickname" aria-describedby="my-cube-username-help basics-username-status" spellcheck="false" required />
          </label>
          <p class="basics-field-help" id="my-cube-username-help">Use 2–24 letters, numbers, _ or -.</p>
          <fieldset class="basics-avatar-fieldset">
            <legend>Avatar</legend>
            <p class="basics-field-help">Choose how you appear in a game.</p>
            <div class="basics-avatar-options" role="radiogroup" aria-label="Avatar">
${avatarOptions}
            </div>
          </fieldset>
          <p class="basics-status" id="basics-username-status" role="status" aria-live="polite"></p>
          <button class="basics-submit" type="submit" disabled>Save</button>
        </form>
      </div>
    </div>`;
}

function cubesMarkup() {
  return `
    <div class="cubes-view" id="cubes">
      <table class="cube-table" aria-label="Available cubes">
        <tbody>
          <tr>
            <td colspan="2">
              <a class="cube-link" href="/?game=first-game">
                <div class="cube-thumbnail" aria-hidden="true"><span>Thumbnail</span></div>
                <span class="cube-name">first-game</span>
              </a>
            </td>
          </tr>
          <tr>
            <td colspan="2">
              <a class="cube-link" href="/?game=second-game">
                <div class="cube-thumbnail" aria-hidden="true"><span>Thumbnail</span></div>
                <span class="cube-name">second-game</span>
              </a>
            </td>
          </tr>
          <tr class="cube-more-row">
            <td colspan="2">
              <a class="cube-link cube-more-link" href="#more-cubes">
                <div class="cube-thumbnail" aria-hidden="true"><span>More</span></div>
                <div class="cube-copy">
                  <span class="cube-name">More</span>
                  <span class="cube-detail">Browse uploaded cubes</span>
                </div>
              </a>
            </td>
          </tr>
        </tbody>
      </table>
    </div>`;
}

function moreCubesMarkup() {
  return `
    <div class="cubes-view more-cubes-view" id="more-cubes">
      <div class="more-cubes-heading">
        <a class="cubes-back-link" href="#cubes">← All cubes</a>
        <h1>More</h1>
        <p>Browse uploaded cubes.</p>
      </div>
      <p class="more-cubes-status" role="status" aria-live="polite">Loading cubes…</p>
      <button class="more-cubes-retry" type="button" hidden>Try again</button>
      <table class="cube-table more-cube-table" aria-label="Uploaded cubes">
        <tbody class="more-cube-table-body"></tbody>
      </table>
    </div>`;
}

function cubeUploadMarkup() {
  return `
    <div class="cube-upload-view" id="upload-cube">
      <div class="cube-upload-heading">
        <h1>Upload a Cube</h1>
        <p>Upload a built cubacadabra cube package. The ZIP must include its manifest and game script.</p>
      </div>
      <form class="cube-upload-form" novalidate>
        <label class="cube-upload-field" for="cube-upload-file">
          <span>Cube package</span>
          <input id="cube-upload-file" name="cube" type="file" accept=".zip,application/zip" required />
        </label>
        <p class="cube-upload-note">ZIP files up to 25 MiB.</p>
        <p class="cube-upload-status" role="status" aria-live="polite"></p>
        <button class="cube-upload-submit" type="submit">Upload cube</button>
      </form>
    </div>`;
}

function blockedUsersMarkup() {
  return `
    <div class="blocked-users-view" id="blocked-users">
      <div class="blocked-users-heading">
        <h1 id="blocked-users-title">Blocked Users</h1>
        <span class="blocked-users-count" aria-live="polite"></span>
      </div>
      <p class="blocked-users-status" role="status" aria-live="polite">Loading blocked users…</p>
      <button class="blocked-users-retry" type="button" hidden>Try again</button>
      <ul class="blocked-users-list"></ul>
    </div>`;
}

function subscriptionMarkup() {
  return [
    '<div class="subscription-view" id="subscription">',
    '  <div class="subscription-heading">',
    '    <h1 id="subscription-title">Subscription</h1>',
    '  </div>',
    '  <div class="subscription-plan">',
    '    <strong>parent-cadabra</strong>',
    '    <span>$9.99 USD / month</span>',
    '    <p>Parents fund the platform directly, so kids can play without casino coins. Please note cubacadabra is a work in progress and your subscription helps fund it. Cancel anytime but please understand you are not buying a finished product yet only helping to support a new one.</p>',
    '  </div>',
    '  <p class="subscription-status" role="status" aria-live="polite">Checking subscription…</p>',
    '  <button class="subscription-cancel-link" type="button" hidden>Cancel subscription</button>',
    '  <button class="subscription-start" type="button" hidden>Continue to payment</button>',
    '  <form class="subscription-checkout-form" hidden>',
    '    <div class="subscription-payment" aria-label="Payment details"></div>',
    '    <p class="subscription-checkout-status" role="status" aria-live="polite"></p>',
    '    <button class="subscription-submit" type="submit" disabled>Subscribe for $9.99/month</button>',
    '  </form>',
    '</div>',
  ].join("");
}

function subscriptionStatusLabel(subscription) {
  const status = typeof subscription?.status === "string" ? subscription.status.trim().toLowerCase() : "";
  return status ? status.replace(/_/g, " ") : "Not active";
}

function hasSubscriptionAccess(subscription) {
  return ["active", "trialing", "past_due", "unpaid", "paused"].includes(
    typeof subscription?.status === "string" ? subscription.status.trim().toLowerCase() : "",
  );
}

async function fetchSubscription() {
  const response = await fetch(backendApiUrl(SUBSCRIPTION_PATH), {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || "subscription_load_failed");
  return result;
}

async function createSubscriptionCheckout() {
  const response = await fetch(backendApiUrl(SUBSCRIPTION_PATH + "/checkout-session"), {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json", "content-type": "application/json" },
    body: "{}",
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || "subscription_checkout_failed");
  return result;
}

async function completeSubscriptionCheckout(checkoutSessionId) {
  const response = await fetch(backendApiUrl(SUBSCRIPTION_PATH + "/checkout-session/complete"), {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ checkout_session_id: checkoutSessionId }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || "subscription_completion_failed");
  return result;
}

async function cancelSubscription(subscriptionId) {
  const response = await fetch(backendApiUrl(SUBSCRIPTION_PATH + "/cancel"), {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ subscription_id: subscriptionId }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || "subscription_cancel_failed");
  return result;
}

function subscriptionErrorMessage(error) {
  if (error.message === "not_authenticated") return "Your session has expired. Please sign in again.";
  if (error.message === "age_required") return "Complete your birthday before starting a subscription.";
  if (error.message === "subscription_cancel_failed") return "We couldn’t cancel the subscription. Please try again.";
  if (error.message === "subscription_not_active") return "The subscription could not be confirmed. Please try again.";
  if (error.message.includes("not configured")) return "Subscriptions are not configured yet. Please try again later.";
  return "We couldn’t load subscription details. Please try again.";
}

function blockedUserLabel(userId) {
  const suffix = userId.slice(-4).toUpperCase();
  return suffix ? `Player ${suffix}` : "Blocked user";
}

async function fetchBlockedUsers() {
  const response = await fetch(backendApiUrl(BLOCKED_USERS_PATH), {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || "blocked_users_load_failed");
  return Array.isArray(result?.user_ids)
    ? result.user_ids.filter((userId) => typeof userId === "string" && userId.trim())
    : [];
}

async function fetchCubeCatalog() {
  const runtime = await accountReady;
  await runtime.dispatch({ type: "load_catalog", page_size: 20 });
  const catalog = runtime.snapshot.catalog;
  if (catalog.feedback?.kind === "error") throw new Error(catalog.feedback.code);
  return catalog.entries.map((entry) => ({
    cubeId: entry.cube_id,
    version: entry.version,
    displayName: entry.display_name,
    packagePath: entry.package_path,
    assetBaseURL: entry.asset_base_url,
  }));
}

function cubeGameUrl(cubeId) {
  const url = new URL("/", window.location.origin);
  url.searchParams.set("game", cubeId);
  return url.href;
}

function createRemoteCubeRow(cube) {
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = 2;
  const link = document.createElement("a");
  link.className = "cube-link";
  link.href = cubeGameUrl(cube.cubeId);

  const thumbnail = document.createElement("div");
  thumbnail.className = "cube-thumbnail";
  thumbnail.setAttribute("aria-hidden", "true");
  const thumbnailLabel = document.createElement("span");
  thumbnailLabel.textContent = "Cube";
  thumbnail.append(thumbnailLabel);

  const copy = document.createElement("div");
  copy.className = "cube-copy";
  const name = document.createElement("span");
  name.className = "cube-name";
  name.textContent = typeof cube.displayName === "string" && cube.displayName.trim()
    ? cube.displayName.trim()
    : cube.cubeId;
  const detail = document.createElement("span");
  detail.className = "cube-detail";
  detail.textContent = `${cube.cubeId} · v${cube.version ?? "?"}`;
  copy.append(name, detail);

  link.append(thumbnail, copy);
  cell.append(link);
  row.append(cell);
  return row;
}

function blockedUsersErrorMessage(error) {
  if (error.message === "age_required") return "Complete your birthday before viewing blocked users.";
  if (error.message === "not_authenticated") return "Your session has expired. Please sign in again.";
  return "We couldn’t load your blocked users. Please try again.";
}

function renderBlockedUserRows(userIds, status, count) {
  const list = content.querySelector(".blocked-users-list");
  list.replaceChildren();
  count.textContent = `${userIds.length} ${userIds.length === 1 ? "user" : "users"}`;

  if (userIds.length === 0) {
    const emptyState = document.createElement("li");
    emptyState.className = "blocked-users-empty";
    emptyState.textContent = "You haven’t blocked anyone.";
    list.append(emptyState);
    return;
  }

  userIds.forEach((userId) => {
    const row = document.createElement("li");
    row.className = "blocked-user-row";

    const identity = document.createElement("div");
    identity.className = "blocked-user-identity";
    const details = document.createElement("div");
    details.className = "blocked-user-details";
    const label = document.createElement("strong");
    label.textContent = blockedUserLabel(userId);
    const id = document.createElement("code");
    id.textContent = userId;
    details.append(label, id);
    identity.append(details);

    const unblock = document.createElement("button");
    unblock.className = "blocked-user-unblock";
    unblock.type = "button";
    unblock.textContent = "Unblock";
    unblock.setAttribute("aria-label", `Unblock ${blockedUserLabel(userId)}`);
    unblock.addEventListener("click", async () => {
      unblock.disabled = true;
      unblock.textContent = "Unblocking…";
      status.textContent = "Saving your change…";
      status.dataset.state = "pending";

      try {
        const response = await fetch(
          `${backendApiUrl(BLOCKED_USERS_PATH)}/${encodeURIComponent(userId)}`,
          { method: "DELETE", credentials: "include", headers: { Accept: "application/json" } },
        );
        const result = await response.json().catch(() => null);
        if (!response.ok) throw new Error(result?.error || "unblock_failed");

        row.remove();
        const remainingRows = list.querySelectorAll(".blocked-user-row").length;
        count.textContent = `${remainingRows} ${remainingRows === 1 ? "user" : "users"}`;
        if (remainingRows === 0) {
          const emptyState = document.createElement("li");
          emptyState.className = "blocked-users-empty";
          emptyState.textContent = "You haven’t blocked anyone.";
          list.append(emptyState);
        }
        status.textContent = `${blockedUserLabel(userId)} was unblocked.`;
        status.dataset.state = "success";
      } catch (error) {
        unblock.disabled = false;
        unblock.textContent = "Unblock";
        status.textContent = "We couldn’t unblock this user. Please try again.";
        status.dataset.state = "error";
      }
    });

    row.append(identity, unblock);
    list.append(row);
  });
}

function renderBirthdayForm() {
  setMenuState(true);
  content.innerHTML = birthdayFormMarkup();
  const form = content.querySelector(".birthday-form");
  const status = content.querySelector(".birthday-status");
  const submit = form.querySelector(".birthday-submit");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const year = form.elements.year.value.trim();
    const month = form.elements.month.value.trim();
    const day = form.elements.day.value.trim();
    const monthNumber = Number(month);
    const dayNumber = Number(day);

    if (!/^\d{4}$/.test(year) || !/^\d{1,2}$/.test(month) || !/^\d{1,2}$/.test(day)
      || monthNumber < 1 || monthNumber > 12 || dayNumber < 1 || dayNumber > 31) {
      setFormStatus(status, "Enter a complete, valid birthday.", "error");
      return;
    }

    submit.disabled = true;
    setFormStatus(status, "Saving your birthday…");
    const dob = `${year}-${String(monthNumber).padStart(2, "0")}-${String(dayNumber).padStart(2, "0")}`;

    try {
      const runtime = await initializeAccountRuntime(currentUser);
      await runtime.dispatch({ type: "save_birthday", date_of_birth: dob });
      const snapshot = runtime.snapshot;
      if (snapshot.account_id !== currentUser?.id || snapshot.profile.date_of_birth !== dob) {
        throw new Error(snapshot.profile.birthday_feedback?.code || "birthday_save_failed");
      }
      currentUser = { ...currentUser, dob: snapshot.profile.date_of_birth };
      const age = calculateAge(snapshot.profile.date_of_birth);
      if (age < 13) {
        renderParentStep();
      } else {
        renderBasics(currentUser);
      }
    } catch (error) {
      submit.disabled = false;
      setFormStatus(
        status,
        error.message === "invalid_date_of_birth"
          ? "That date is not valid. Check the year, month, and day, then try again."
          : "We couldn’t save your birthday. Please try again.",
        "error",
      );
    }
  });
}

function renderParentStep() {
  setMenuState(true);
  content.innerHTML = parentStepMarkup();
  const form = content.querySelector(".parent-email-form");
  const email = content.querySelector("#parent-email");
  const status = content.querySelector(".birthday-status");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!email.validity.valid) {
      email.focus();
      setFormStatus(status, "Enter your parent or guardian’s email address.", "error");
      return;
    }
    setFormStatus(status, "Parent sign-up will continue here next.");
  });
  email.focus();
}

async function renderBasics(user) {
  setMenuState(false);
  content.innerHTML = basicsMarkup();
  const form = content.querySelector(".basics-form");
  const input = content.querySelector("#my-cube-username");
  const status = content.querySelector("#basics-username-status");
  const submit = form.querySelector(".basics-submit");
  const avatarInputs = [...form.querySelectorAll('input[name="body_id"]')];
  input.disabled = true;
  setFormStatus(status, "Loading profile…");

  let runtime;
  try { runtime = await accountReady; }
  catch {
    if (!form.isConnected) return;
    setFormStatus(status, "We couldn’t load your profile. Please reload and try again.", "error");
    submit.disabled = false;
    submit.textContent = "Reload";
    form.addEventListener("submit", (event) => { event.preventDefault(); window.location.reload(); });
    return;
  }
  if (!form.isConnected) return;
  runtime.dispatch({ type: "begin_username_edit" });
  const sessionId = runtime.snapshot.session_id;
  const accountId = runtime.snapshot.account_id;
  const activeSession = () => accountId !== null
    && runtime.snapshot.session_id === sessionId && runtime.snapshot.account_id === accountId;
  let savingBasics = false;
  let basicsFeedback = null;

  const render = ({ profile }) => {
    if (!form.isConnected) return;
    const active = activeSession();
    if (input.value !== profile.username_draft) input.value = profile.username_draft;
    input.disabled = !active;
    input.setAttribute("aria-invalid", String(profile.username_feedback?.kind === "error"
      && profile.username_validation_error !== null));
    avatarInputs.forEach((control) => {
      // Keep avatar selection available while a username or avatar request is
      // in flight. Rust keeps the submitted value separate from this draft,
      // so a response cannot overwrite a newer selection.
      control.disabled = !active;
      control.checked = control.value === profile.body_draft;
    });
    submit.disabled = !active || savingBasics || profile.username_is_saving
      || profile.body_is_saving || !(profile.username_can_save || profile.body_can_save);
    submit.setAttribute("aria-busy", String(savingBasics
      || profile.username_is_saving || profile.body_is_saving));
    const feedback = basicsFeedback ?? profile.body_feedback ?? profile.username_feedback;
    setFormStatus(status,
      !active ? "Please sign in again."
        : feedback?.kind === "error" ? feedback.message
          : savingBasics || profile.username_is_saving || profile.body_is_saving ? "Saving your basics…"
            : feedback?.message ?? "",
      !active ? "error" : feedback?.kind === "error" ? "error"
        : savingBasics || profile.username_is_saving || profile.body_is_saving ? "pending" : feedback?.kind ?? "");
  };
  basicsCleanup = runtime.subscribe(render);
  input.addEventListener("input", () => {
    basicsFeedback = null;
    runtime.dispatch({ type: "username_changed", value: input.value });
  });
  avatarInputs.forEach((control) => control.addEventListener("change", () => {
    basicsFeedback = null;
    runtime.dispatch({ type: "body_changed", body_id: control.value });
  }));

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!activeSession() || savingBasics || runtime.snapshot.profile.username_is_saving
      || runtime.snapshot.profile.body_is_saving) return;
    // Do not turn a username-only save into an unnecessary avatar request.
    // Capture this before starting the asynchronous username request so a
    // later avatar selection remains an unsaved draft for the next submit.
    const shouldSaveBody = runtime.snapshot.profile.body_can_save;
    savingBasics = true;
    basicsFeedback = null;
    render(runtime.snapshot);
    try {
      // Rust handles validation, unchanged names, pending work and all username errors.
      await runtime.dispatch({ type: "save_username" });
      const profile = runtime.snapshot.profile;
      if (!activeSession() || !form.isConnected || profile.username_validation_error
        || profile.username_is_dirty || profile.username_feedback?.kind === "error") return;
      if (shouldSaveBody) {
        await runtime.dispatch({ type: "save_body" });
        if (runtime.snapshot.profile.body_feedback?.kind === "error") return;
      }
      const finalProfile = runtime.snapshot.profile;
      if (!activeSession()) return;
      currentUser = { ...currentUser, username: finalProfile.username, body_id: finalProfile.body_id };
      basicsFeedback = { kind: "success", message: "Basics saved." };
    } catch (error) {
      basicsFeedback = {
        kind: "error",
        message: error.message === "invalid_body_id" ? "Choose one of the available avatars."
          : error.message === "age_required" ? "Complete the birthday step before choosing your basics."
            : "We couldn’t save your basics. Please try again.",
      };
    } finally {
      savingBasics = false;
      render(runtime.snapshot);
    }
  });
  input.focus();
  input.select();
}

function renderCubes() {
  setMenuState(false, "cubes");
  content.innerHTML = cubesMarkup();
  content.querySelector(".cube-more-link")?.addEventListener("click", (event) => {
    event.preventDefault();
    renderMoreCubes();
  });
}

function renderMoreCubes() {
  setMenuState(false, "cubes");
  content.innerHTML = moreCubesMarkup();

  const back = content.querySelector(".cubes-back-link");
  const status = content.querySelector(".more-cubes-status");
  const retry = content.querySelector(".more-cubes-retry");
  const tableBody = content.querySelector(".more-cube-table-body");

  const load = async () => {
    status.textContent = "Loading cubes…";
    status.dataset.state = "pending";
    retry.hidden = true;
    tableBody.replaceChildren();
    try {
      const cubes = await fetchCubeCatalog();
      if (cubes.length === 0) {
        status.textContent = "No uploaded cubes yet.";
        status.dataset.state = "";
        return;
      }
      cubes.forEach((cube) => tableBody.append(createRemoteCubeRow(cube)));
      status.textContent = "";
      status.dataset.state = "";
    } catch (error) {
      status.textContent = "We couldn’t load the uploaded cubes. Please try again.";
      status.dataset.state = "error";
      retry.hidden = false;
    }
  };

  back?.addEventListener("click", (event) => {
    event.preventDefault();
    renderCubes();
  });
  retry.addEventListener("click", load);
  load();
}

function cubeUploadErrorMessage(error) {
  switch (error.message) {
    case "cube_zip_too_large":
      return "That ZIP is larger than the 25 MiB limit.";
    case "zip_required":
      return "Choose a ZIP file to upload.";
    case "invalid_cube_id":
      return "The cube ID must use lowercase letters, numbers, and dashes.";
    case "invalid_cube_version":
      return "The cube manifest needs a valid version number.";
    case "invalid_display_name":
      return "The cube display name is invalid.";
    case "cube_already_exists":
      return "That cube version is already uploaded to your account.";
    case "not_authenticated":
      return "Your session has expired. Please sign in again.";
    case "invalid_cube_package":
    case "invalid_archive":
    case "invalid_manifest":
    case "invalid_package":
    case "invalid_package_metadata":
    case "missing_required_file":
    case "invalid_archive_path":
    case "invalid_archive_files":
    case "unsupported_archive_compression":
    case "empty_archive":
    case "invalid_script":
      return "That ZIP is not a valid cube package.";
    case "cube_file_too_large":
    case "cube_uncompressed_too_large":
      return "The files inside that ZIP are larger than the cube limit.";
    default:
      return "We couldn’t upload that cube. Please try again.";
  }
}

async function uploadCube(file) {
  const response = await fetch(backendApiUrl(CUBE_UPLOAD_PATH), {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "content-type": "application/zip",
    },
    body: file,
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || "cube_upload_failed");
  return result;
}

function renderCubeUpload() {
  const age = currentUser?.dob ? calculateAge(currentUser.dob) : null;
  setMenuState(!currentUser?.dob || age === null || age < 13, "upload-cube");
  content.innerHTML = cubeUploadMarkup();

  const form = content.querySelector(".cube-upload-form");
  const fileInput = content.querySelector("#cube-upload-file");
  const submit = content.querySelector(".cube-upload-submit");
  const status = content.querySelector(".cube-upload-status");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const file = fileInput.files?.[0];
    if (!file) {
      setFormStatus(status, "Choose a ZIP file first.", "error");
      return;
    }
    if (file.size > MAX_CUBE_ZIP_BYTES) {
      setFormStatus(status, "That ZIP is larger than the 25 MiB limit.", "error");
      return;
    }

    submit.disabled = true;
    setFormStatus(status, "Uploading and checking your cube…", "pending");
    try {
      const result = await uploadCube(file);
      const cube = result.cube;
      setFormStatus(
        status,
        `${cube.displayName} ${cube.version} was uploaded successfully.`,
        "success",
      );
      fileInput.value = "";
    } catch (error) {
      setFormStatus(status, cubeUploadErrorMessage(error), "error");
    } finally {
      submit.disabled = false;
    }
  });
}

async function renderBlockedUsers() {
  setMenuState(false, "blocked-users");
  content.innerHTML = blockedUsersMarkup();

  const status = content.querySelector(".blocked-users-status");
  const count = content.querySelector(".blocked-users-count");
  const retry = content.querySelector(".blocked-users-retry");
  try {
    const userIds = await fetchBlockedUsers();
    retry.hidden = true;
    renderBlockedUserRows(userIds, status, count);
    status.textContent = "";
    status.dataset.state = "";
  } catch (error) {
    count.textContent = "";
    status.textContent = blockedUsersErrorMessage(error);
    status.dataset.state = "error";
    retry.hidden = false;
    retry.addEventListener("click", () => renderBlockedUsers(), { once: true });
  }
}

async function renderSubscription() {
  subscriptionCheckoutCleanup?.();
  subscriptionCheckoutCleanup = null;
  setMenuState(false, "subscription");
  content.innerHTML = subscriptionMarkup();

  const status = content.querySelector(".subscription-status");
  const cancel = content.querySelector(".subscription-cancel-link");
  const start = content.querySelector(".subscription-start");
  const form = content.querySelector(".subscription-checkout-form");
  const payment = content.querySelector(".subscription-payment");
  const checkoutStatus = content.querySelector(".subscription-checkout-status");
  const submit = content.querySelector(".subscription-submit");
  const params = new URLSearchParams(window.location.search);
  const returnSessionId = params.get("checkout_session_id");
  const hasReturnSession = params.get("subscription_return") === "1" && returnSessionId;
  let activeSubscription = null;

  start.addEventListener("click", async () => {
    start.disabled = true;
    start.textContent = "Loading payment form…";
    status.textContent = "Preparing secure payment…";
    status.dataset.state = "pending";

    try {
      const checkout = await createSubscriptionCheckout();
      if (!checkout.client_secret || !checkout.publishable_key) {
        throw new Error("subscription_checkout_unavailable");
      }

      start.hidden = true;
      form.hidden = false;
      subscriptionCheckoutCleanup = mountStripeEmbeddedCheckout({
        container: payment,
        form,
        submitButton: submit,
        statusElement: checkoutStatus,
        clientSecret: checkout.client_secret,
        publishableKey: checkout.publishable_key,
        onComplete: async (session) => {
          checkoutStatus.textContent = "Finalizing subscription…";
          checkoutStatus.dataset.state = "pending";
          const completed = session?.id
            ? await completeSubscriptionCheckout(session.id)
            : await fetchSubscription();
          const nextSubscription = completed?.subscription || completed?.membership?.subscription;
          if (!hasSubscriptionAccess(nextSubscription)) throw new Error("subscription_not_active");
          activeSubscription = nextSubscription;
          cancel.hidden = false;
          status.textContent = "parent-cadabra is active. Thank you for funding the world.";
          status.dataset.state = "success";
          form.hidden = true;
          checkoutStatus.textContent = "";
          subscriptionCheckoutCleanup?.();
          subscriptionCheckoutCleanup = null;
        },
        onError: (message) => {
          checkoutStatus.textContent = message;
          checkoutStatus.dataset.state = "error";
        },
      });
      status.textContent = "Enter your payment details below.";
      status.dataset.state = "";
    } catch (error) {
      start.disabled = false;
      start.textContent = "Try again";
      status.textContent = subscriptionErrorMessage(error);
      status.dataset.state = "error";
    }
  });

  cancel.addEventListener("click", async () => {
    if (!activeSubscription?.id || cancel.disabled) return;
    if (!window.confirm("Cancel your parent-cadabra subscription now?")) return;

    cancel.disabled = true;
    cancel.textContent = "Cancelling…";
    status.textContent = "Cancelling subscription…";
    status.dataset.state = "pending";
    try {
      await cancelSubscription(activeSubscription.id);
      activeSubscription = null;
      form.hidden = true;
      subscriptionCheckoutCleanup?.();
      subscriptionCheckoutCleanup = null;
      cancel.hidden = true;
      cancel.disabled = false;
      cancel.textContent = "Cancel subscription";
      start.hidden = false;
      start.disabled = false;
      start.textContent = "Continue to payment";
      status.textContent = "Subscription canceled. You can subscribe again anytime.";
      status.dataset.state = "success";
    } catch (error) {
      cancel.disabled = false;
      cancel.textContent = "Cancel subscription";
      status.textContent = subscriptionErrorMessage(error);
      status.dataset.state = "error";
    }
  });

  try {
    const subscriptionData = await fetchSubscription();
    const subscription = subscriptionData.subscription;
    if (hasSubscriptionAccess(subscription)) {
      activeSubscription = subscription;
      cancel.hidden = false;
      status.textContent = hasReturnSession ? "Finalizing subscription…" : "parent-cadabra is " + subscriptionStatusLabel(subscription) + ".";
      status.dataset.state = "success";
      if (hasReturnSession) {
        try {
          const completed = await completeSubscriptionCheckout(returnSessionId);
          const completedSubscription = completed?.subscription;
          activeSubscription = completedSubscription;
          cancel.hidden = !hasSubscriptionAccess(completedSubscription);
          status.textContent = hasSubscriptionAccess(completedSubscription)
            ? "parent-cadabra is active. Thank you for funding the world."
            : "Subscription payment needs attention. Please try again.";
          status.dataset.state = hasSubscriptionAccess(completedSubscription) ? "success" : "error";
        } catch (error) {
          status.textContent = subscriptionErrorMessage(error);
          status.dataset.state = "error";
        }
        params.delete("subscription_return");
        params.delete("checkout_session_id");
        const nextQuery = params.toString();
        window.history.replaceState(
          {},
          "",
          window.location.pathname + (nextQuery ? "?" + nextQuery : "") + window.location.hash,
        );
      }
      return;
    }

    if (!subscriptionData.configured) {
      status.textContent = "Subscriptions are not configured yet.";
      status.dataset.state = "error";
      return;
    }

    status.textContent = "No active subscription.";
    start.hidden = false;
  } catch (error) {
    status.textContent = subscriptionErrorMessage(error);
    status.dataset.state = "error";
    return;
  }

  if (hasReturnSession) {
    start.hidden = true;
    status.textContent = "Finalizing subscription…";
    status.dataset.state = "pending";
    try {
      const completed = await completeSubscriptionCheckout(returnSessionId);
      const nextSubscription = completed?.subscription;
      status.textContent = hasSubscriptionAccess(nextSubscription)
        ? "parent-cadabra is active. Thank you for funding the world."
        : "Subscription payment needs attention. Please try again.";
      status.dataset.state = hasSubscriptionAccess(nextSubscription) ? "success" : "error";
    } catch (error) {
      start.hidden = false;
      start.disabled = false;
      start.textContent = "Try again";
      status.textContent = subscriptionErrorMessage(error);
      status.dataset.state = "error";
    }
    params.delete("subscription_return");
    params.delete("checkout_session_id");
    const nextQuery = params.toString();
    window.history.replaceState(
      {},
      "",
      window.location.pathname + (nextQuery ? "?" + nextQuery : "") + window.location.hash,
    );
  }
}

menuLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    if (link.hidden) {
      event.preventDefault();
      return;
    }

    if (link.dataset.section === "cubes") {
      event.preventDefault();
      renderCubes();
    } else if (link.dataset.section === "upload-cube" && currentUser) {
      event.preventDefault();
      renderCubeUpload();
    } else if (link.dataset.section === "blocked-users" && currentUser) {
      event.preventDefault();
      renderBlockedUsers();
    } else if (link.dataset.section === "basics" && currentUser) {
      event.preventDefault();
      renderBasics(currentUser);
    } else if (link.dataset.section === "subscription" && currentUser) {
      event.preventDefault();
      renderSubscription();
    }
  });
});

getCurrentUser().then((user) => {
  if (!user) {
    window.location.replace(loginPath);
    return;
  }

  initializeLogoutButton(user);
  currentUser = user;
  accountReady = initializeAccountRuntime(user).then((runtime) => {
    runtime.subscribe((snapshot) => {
      if (snapshot.account_id === null) currentUser = null;
      else if (currentUser?.id === snapshot.account_id) {
        currentUser = { ...currentUser, username: snapshot.profile.username };
      }
    });
    return runtime;
  });
  // Other account sections remain available if the username module cannot load.
  accountReady.catch(() => {});
  document.body.dataset.authenticated = "true";

  const age = calculateAge(user.dob);
  if (window.location.hash === "#upload-cube") {
    renderCubeUpload();
  } else if (!user.dob || age === null) {
    renderBirthdayForm();
  } else if (age !== null && age < 13) {
    renderParentStep();
  } else if (window.location.hash === "#cubes") {
    renderCubes();
  } else if (window.location.hash === "#more-cubes") {
    renderMoreCubes();
  } else if (window.location.hash === "#blocked-users") {
    renderBlockedUsers();
  } else if (window.location.hash === "#subscription") {
    renderSubscription();
  } else {
    renderBasics(user);
  }
});

// A restored document must re-read cookie authentication before accepting edits.
window.addEventListener("pagehide", () => clearAccountSession());
window.addEventListener("pageshow", (event) => { if (event.persisted) window.location.reload(); });
