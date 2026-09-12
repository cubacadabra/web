import { getCurrentUser, initializeLogoutButton } from "../src/auth/session.js";
import { backendApiUrl } from "../src/config/clientConfig.js";

const content = document.querySelector(".developer-content");
const menuLinks = [...document.querySelectorAll(".about-menu > a[data-section]")];
const defaultContent = content?.innerHTML || "";
const MAX_CUBE_ZIP_BYTES = 25 * 1024 * 1024;
const CUBE_UPLOAD_PATH = "/cubes/upload";
let currentUserPromise = null;
let routeVersion = 0;

function loginPath() {
  const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
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
  if (!currentUserPromise) {
    currentUserPromise = getCurrentUser().then((user) => {
      if (!user) {
        window.location.replace(loginPath());
        return null;
      }
      initializeLogoutButton(user);
      document.body.dataset.authenticated = "true";
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
  if (content.innerHTML !== defaultContent) content.innerHTML = defaultContent;
  setMenuState(window.location.hash === "#included" ? "included" : "pricing");
}

function routeFromHash() {
  if (window.location.hash === "#upload") showUpload();
  else showPublicContent();
}

window.addEventListener("hashchange", routeFromHash);
routeFromHash();
