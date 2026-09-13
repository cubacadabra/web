import { getCurrentUser, initializeLogoutButton } from "../src/auth/session.js";
import { backendApiUrl } from "../src/config/clientConfig.js";
import { mountStripeEmbeddedCheckout } from "../src/payments/stripeEmbeddedCheckout.js";

const content = document.querySelector(".developer-content");
const menuLinks = [...document.querySelectorAll(".about-menu > a[data-section]")];
const defaultContent = content?.innerHTML || "";
const MAX_CUBE_ZIP_BYTES = 25 * 1024 * 1024;
const CUBE_UPLOAD_PATH = "/cubes/upload";
const DEVELOPER_CHECKOUT_PATH = "/developer";
const DEVELOPER_PLANS = {
  "creator-pro": {
    name: "Creator Pro",
    price: "$20",
    submitLabel: "Subscribe to Creator Pro · $20/month",
  },
  studio: {
    name: "Studio",
    price: "$99",
    submitLabel: "Subscribe to Studio · $99/month",
  },
};
let currentUserPromise = null;
let currentUser = null;
let routeVersion = 0;
let developerCheckoutCleanup = null;
const DEVELOPER_ACTIVE_STATUSES = new Set(["active", "trialing", "past_due", "unpaid", "paused"]);

function developerPath(plan = "") {
  const params = new URLSearchParams();
  if (DEVELOPER_PLANS[plan]) params.set("plan", plan);
  const query = params.toString();
  return `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
}

function loginPath(returnTo = developerPath()) {
  return `/login/?returnTo=${encodeURIComponent(returnTo)}`;
}

function setMenuState(activeSection) {
  menuLinks.forEach((link) => {
    const isActive = link.dataset.section === activeSection;
    link.classList.toggle("is-active", isActive);
    if (isActive) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

function setFormStatus(statusElement, message, state = "") {
  statusElement.textContent = message;
  statusElement.dataset.state = state;
}

function clearCheckoutReturnParams() {
  const params = new URLSearchParams(window.location.search);
  params.delete("developer_return");
  params.delete("checkout_session_id");
  params.delete("plan");
  const query = params.toString();
  window.history.replaceState(
    {},
    "",
    window.location.pathname + (query ? `?${query}` : "") + window.location.hash,
  );
}

function developerCheckoutMarkup(plan) {
  const details = DEVELOPER_PLANS[plan];
  return `
    <div class="developer-checkout-view" id="developer-checkout" aria-labelledby="developer-checkout-title">
      <div class="developer-checkout-heading">
        <button class="developer-checkout-back" type="button">← Back to plans</button>
        <p class="developer-kicker">Secure checkout</p>
        <h1 id="developer-checkout-title">${details.name}</h1>
        <p>Enter your payment details to start your monthly developer subscription.</p>
      </div>
      <div class="developer-checkout-plan">
        <div>
          <strong>${details.name}</strong>
          <span>${details.price} USD / month</span>
        </div>
        <p>Please note cubacadabra is a work in progress and your subscription helps fund it. Cancel anytime but please understand you are not buying a finished product yet only helping to support a new one.</p>
      </div>
      <p class="developer-checkout-status" role="status" aria-live="polite">Preparing secure payment…</p>
      <form class="developer-checkout-form" hidden>
        <div class="developer-checkout-payment" aria-label="Payment details"></div>
        <p class="developer-checkout-form-status" role="status" aria-live="polite"></p>
        <button class="developer-checkout-submit" type="submit" disabled>${details.submitLabel}</button>
      </form>
    </div>`;
}

function developerCheckoutErrorMessage(error) {
  if (error.message === "not_authenticated") return "Your session has expired. Please sign in again.";
  if (error.message === "age_required") return "Complete your birthday before starting a subscription.";
  if (error.message === "invalid_plan") return "Choose a valid developer plan.";
  if (error.message.includes("not configured")) return "Developer subscriptions are not configured yet. Please try again later.";
  return "We couldn’t load the payment form. Please try again.";
}

function developerPlanErrorMessage(error) {
  if (error.message === "not_authenticated") return "Your session has expired. Please sign in again.";
  if (error.message === "age_required") return "Complete your birthday before changing a subscription.";
  if (error.message.includes("not configured")) return "Developer subscriptions are not configured yet. Please try again later.";
  return "We couldn’t update your developer plan. Please try again.";
}

async function createDeveloperCheckout(plan) {
  const response = await fetch(backendApiUrl(DEVELOPER_CHECKOUT_PATH + "/checkout-session"), {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ plan }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || "developer_checkout_failed");
  return result;
}

async function completeDeveloperCheckout(checkoutSessionId) {
  const response = await fetch(backendApiUrl(DEVELOPER_CHECKOUT_PATH + "/checkout-session/complete"), {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ checkout_session_id: checkoutSessionId }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || "developer_completion_failed");
  return result;
}

async function fetchDeveloperSubscriptions() {
  const response = await fetch(backendApiUrl(DEVELOPER_CHECKOUT_PATH), {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || "developer_subscriptions_failed");
  return result;
}

async function cancelDeveloperSubscription(subscriptionId) {
  const response = await fetch(backendApiUrl(DEVELOPER_CHECKOUT_PATH + "/cancel"), {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ subscription_id: subscriptionId }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || "developer_cancel_failed");
  return result;
}

async function upgradeDeveloperSubscription(subscriptionId) {
  const response = await fetch(backendApiUrl(DEVELOPER_CHECKOUT_PATH + "/upgrade"), {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ subscription_id: subscriptionId }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || "developer_upgrade_failed");
  return result;
}

function hasDeveloperAccess(subscription) {
  return DEVELOPER_ACTIVE_STATUSES.has(subscription?.status);
}

function developerActionMarkup(plan, subscription, canUpgrade, higherPlanActive) {
  const details = DEVELOPER_PLANS[plan];
  if (plan === "creator-pro" && higherPlanActive) {
    return `<span class="developer-plan-action developer-plan-plan-note" aria-label="Included with Studio">Included with Studio</span>`;
  }
  if (hasDeveloperAccess(subscription)) {
    return `<button class="developer-plan-action developer-plan-manage" data-developer-manage="cancel" data-developer-plan="${plan}" data-developer-subscription-id="${subscription.id}" type="button">Cancel ${details.name} <span aria-hidden="true">×</span></button>`;
  }
  if (plan === "studio" && canUpgrade) {
    return `<button class="developer-plan-action developer-plan-manage developer-plan-upgrade" data-developer-manage="upgrade" data-developer-plan="${plan}" data-developer-subscription-id="${canUpgrade.id}" type="button">Upgrade to Studio <span aria-hidden="true">↗</span></button>`;
  }
  return `<a class="developer-plan-action" data-developer-plan="${plan}" href="${loginPath(developerPath(plan))}">${plan === "studio" ? "Plan a Studio" : "Choose Creator Pro"} <span aria-hidden="true">↗</span></a>`;
}

function setDeveloperPlansStatus(message, state = "") {
  const status = content.querySelector(".developer-plans-status");
  if (!status) return;
  status.textContent = message;
  status.dataset.state = state;
}

function renderDeveloperPlanActions(payload) {
  const pricing = content.querySelector(".developer-pricing");
  if (!pricing) return;
  const subscriptions = payload?.plans || {};
  const creatorPro = subscriptions["creator-pro"];
  const cards = {
    "creator-pro": content.querySelector("#creator-pro"),
    studio: content.querySelector("#studio"),
  };

  Object.entries(cards).forEach(([plan, card]) => {
    if (!card) return;
    const badge = card.querySelector(".developer-plan-badge");
    if (badge && !badge.dataset.defaultLabel) badge.dataset.defaultLabel = badge.textContent;
    const activeSubscription = subscriptions[plan];
    const isActive = hasDeveloperAccess(activeSubscription);
    if (badge) badge.textContent = isActive ? "Current plan" : badge.dataset.defaultLabel;

    const action = card.querySelector(".developer-plan-action");
    if (action) {
      action.outerHTML = developerActionMarkup(
        plan,
        activeSubscription,
        plan === "studio" && hasDeveloperAccess(creatorPro) ? creatorPro : null,
        plan === "creator-pro" && hasDeveloperAccess(subscriptions.studio),
      );
    }
  });
  pricing.dataset.planState = "ready";
}

async function loadDeveloperPlanStatus(user) {
  if (!user || window.location.hash === "#upload") return;
  const version = routeVersion;
  const pricing = content.querySelector(".developer-pricing");
  if (!pricing) return;
  pricing.dataset.planState = "loading";
  setDeveloperPlansStatus("Checking your current plan…", "pending");
  try {
    const payload = await fetchDeveloperSubscriptions();
    if (version !== routeVersion || !content.querySelector(".developer-pricing")) return;
    renderDeveloperPlanActions(payload);
    setDeveloperPlansStatus("", "");
  } catch (error) {
    if (version !== routeVersion || !content.querySelector(".developer-pricing")) return;
    pricing.dataset.planState = "ready";
    setDeveloperPlansStatus(developerCheckoutErrorMessage(error), "error");
  }
}

function cubeUploadMarkup() {
  return `
    <div class="cube-upload-view developer-upload-view" id="upload">
      <div class="cube-upload-heading">
        <p class="developer-kicker">Creator tools</p>
        <h1>Upload a Cube</h1>
        <p>Upload a built cubacadabra cube package. Its manifest supplies the unique cube ID and display name.</p>
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

function loadingMarkup() {
  return `
    <div class="cube-upload-view developer-upload-view" id="upload">
      <div class="cube-upload-heading">
        <p class="developer-kicker">Creator tools</p>
        <h1>Upload a Cube</h1>
        <p class="cube-upload-status" role="status" aria-live="polite">Checking your sign-in…</p>
      </div>
    </div>`;
}

function cubeUploadErrorMessage(error) {
  switch (error.message) {
    case "cube_zip_too_large":
      return "That ZIP is larger than the 25 MiB limit.";
    case "zip_required":
      return "Choose a ZIP file to upload.";
    case "invalid_cube_id":
      return "The cube ID must be 3–64 characters using lowercase letters, numbers, and single dashes.";
    case "invalid_cube_version":
      return "The cube manifest needs a valid version number.";
    case "invalid_display_name":
      return "The cube display name is invalid.";
    case "cube_already_exists":
      return "That cube version is already uploaded to your account.";
    case "cube_id_taken":
      return "That cube ID is already used by another creator. Choose a different ID in manifest.json.";
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

function renderUploadForm() {
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
      setFormStatus(status, `${cube.displayName} ${cube.version} was uploaded successfully.`, "success");
      fileInput.value = "";
    } catch (error) {
      setFormStatus(status, cubeUploadErrorMessage(error), "error");
    } finally {
      submit.disabled = false;
    }
  });
}

async function getUploadUser() {
  const user = await getDeveloperUser();
  if (!user) {
    window.location.replace(loginPath());
    return null;
  }
  return user;
}

function getDeveloperUser() {
  if (!currentUserPromise) {
    currentUserPromise = getCurrentUser().then((user) => {
      currentUser = user;
      if (user) {
        initializeLogoutButton(user);
        document.body.dataset.authenticated = "true";
      }
      return user;
    });
  }
  return currentUserPromise;
}

async function showUpload() {
  const version = ++routeVersion;
  setMenuState("upload");
  content.innerHTML = loadingMarkup();
  const user = await getUploadUser();
  if (!user || version !== routeVersion || window.location.hash !== "#upload") return;
  renderUploadForm();
}

function showPublicContent() {
  routeVersion += 1;
  developerCheckoutCleanup?.();
  developerCheckoutCleanup = null;
  if (content.innerHTML !== defaultContent) content.innerHTML = defaultContent;
  setMenuState(window.location.hash === "#included" ? "included" : "pricing");
  if (currentUser) loadDeveloperPlanStatus(currentUser);
}

function showDeveloperCheckoutSuccess(plan) {
  const details = DEVELOPER_PLANS[plan];
  const status = content.querySelector(".developer-checkout-status");
  const form = content.querySelector(".developer-checkout-form");
  developerCheckoutCleanup?.();
  developerCheckoutCleanup = null;
  form.hidden = true;
  status.textContent = `${details.name} is active. Thank you for supporting cubacadabra.`;
  status.dataset.state = "success";
  clearCheckoutReturnParams();
}

async function renderDeveloperCheckout(plan) {
  const details = DEVELOPER_PLANS[plan];
  if (!details) {
    showPublicContent();
    return;
  }

  const version = ++routeVersion;
  developerCheckoutCleanup?.();
  developerCheckoutCleanup = null;
  setMenuState("pricing");
  content.innerHTML = developerCheckoutMarkup(plan);

  const back = content.querySelector(".developer-checkout-back");
  const status = content.querySelector(".developer-checkout-status");
  const form = content.querySelector(".developer-checkout-form");
  const payment = content.querySelector(".developer-checkout-payment");
  const formStatus = content.querySelector(".developer-checkout-form-status");
  const submit = content.querySelector(".developer-checkout-submit");
  const params = new URLSearchParams(window.location.search);
  const returnSessionId = params.get("developer_return") === "1"
    && params.get("plan") === plan
    ? params.get("checkout_session_id")
    : "";

  back.addEventListener("click", () => {
    clearCheckoutReturnParams();
    showPublicContent();
  });

  try {
    const user = await getDeveloperUser();
    if (!user) {
      window.location.replace(loginPath(developerPath(plan)));
      return;
    }
    if (version !== routeVersion) return;

    if (returnSessionId) {
      status.textContent = "Finalizing subscription…";
      status.dataset.state = "pending";
      await completeDeveloperCheckout(returnSessionId);
      if (version === routeVersion) showDeveloperCheckoutSuccess(plan);
      return;
    }

    const checkout = await createDeveloperCheckout(plan);
    if (version !== routeVersion) return;
    if (!checkout.client_secret || !checkout.publishable_key) {
      throw new Error("developer_checkout_unavailable");
    }

    form.hidden = false;
    status.textContent = "Enter your payment details below.";
    status.dataset.state = "";
    developerCheckoutCleanup = mountStripeEmbeddedCheckout({
      container: payment,
      form,
      submitButton: submit,
      statusElement: formStatus,
      clientSecret: checkout.client_secret,
      publishableKey: checkout.publishable_key,
      submitLabel: details.submitLabel,
      onComplete: async (session) => {
        formStatus.textContent = "Finalizing subscription…";
        formStatus.dataset.state = "pending";
        if (!session?.id) throw new Error("developer_completion_failed");
        await completeDeveloperCheckout(session?.id);
        if (version === routeVersion) showDeveloperCheckoutSuccess(plan);
      },
      onError: (message) => {
        formStatus.textContent = message;
        formStatus.dataset.state = "error";
      },
    });
  } catch (error) {
    if (version !== routeVersion) return;
    status.textContent = developerCheckoutErrorMessage(error);
    status.dataset.state = "error";
  }
}

function handleDeveloperContentClick(event) {
  const manageButton = event.target.closest("[data-developer-manage]");
  if (manageButton) {
    event.preventDefault();
    const action = manageButton.dataset.developerManage;
    const plan = manageButton.dataset.developerPlan;
    const subscriptionId = manageButton.dataset.developerSubscriptionId;
    if (!action || !plan || !subscriptionId || manageButton.disabled) return;
    const planName = DEVELOPER_PLANS[plan]?.name || "developer";
    if (action === "cancel" && !window.confirm(`Cancel your ${planName} subscription now?`)) return;

    manageButton.disabled = true;
    setDeveloperPlansStatus(action === "upgrade" ? "Upgrading to Studio…" : `Cancelling ${planName}…`, "pending");
    const request = action === "upgrade"
      ? upgradeDeveloperSubscription(subscriptionId)
      : cancelDeveloperSubscription(subscriptionId);
    request.then(async () => {
      await loadDeveloperPlanStatus(currentUser);
      setDeveloperPlansStatus(
        action === "upgrade" ? "Studio is now your current plan." : `${planName} was canceled.`,
        "success",
      );
    }).catch((error) => {
      manageButton.disabled = false;
      setDeveloperPlansStatus(developerPlanErrorMessage(error), "error");
    });
    return;
  }

  const uploadLink = event.target.closest("[data-developer-upload]");
  if (uploadLink) {
    event.preventDefault();
    getDeveloperUser().then((user) => {
      const uploadPath = "/developer/#upload";
      window.location.assign(user ? uploadPath : loginPath(uploadPath));
    });
    return;
  }

  const planLink = event.target.closest("[data-developer-plan]");
  if (planLink) {
    event.preventDefault();
    const plan = planLink.dataset.developerPlan;
    getDeveloperUser().then((user) => {
      if (!user) {
        window.location.assign(loginPath(developerPath(plan)));
        return;
      }
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set("plan", plan);
      nextUrl.hash = "";
      window.history.pushState({}, "", nextUrl);
      renderDeveloperCheckout(plan);
    });
    return;
  }
}

function routeFromHash() {
  if (window.location.hash === "#upload") showUpload();
  else showPublicContent();
}

window.addEventListener("hashchange", routeFromHash);
content?.addEventListener("click", handleDeveloperContentClick);
routeFromHash();

getDeveloperUser().then((user) => {
  const params = new URLSearchParams(window.location.search);
  const plan = params.get("plan");
  if (window.location.hash === "#upload" || content.querySelector(".developer-checkout-view")) return;
  if (!user) {
    if (plan && DEVELOPER_PLANS[plan]) window.location.replace(loginPath(developerPath(plan)));
    return;
  }
  if (!plan) loadDeveloperPlanStatus(user);
  else if (DEVELOPER_PLANS[plan]) renderDeveloperCheckout(plan);
});
