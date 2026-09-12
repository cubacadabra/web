import { backendApiUrl } from "../src/config/clientConfig.js";

const CUBE_ID_PATTERN = /^(?=.{3,64}$)[a-z0-9]+(?:-[a-z0-9]+)*$/;
const root = document.querySelector("#cube-page-root");

function cubeIdFromPath() {
  const match = window.location.pathname.match(/^\/cube\/([^/]+)\/?$/);
  if (!match) return null;
  try {
    const cubeId = decodeURIComponent(match[1]);
    return cubeId.trim() === cubeId && CUBE_ID_PATTERN.test(cubeId) ? cubeId : null;
  } catch {
    return null;
  }
}

function setMeta(cube) {
  const title = `${cube.displayName} · cubacadabra`;
  const description = `Enter ${cube.displayName} on cubacadabra.`;
  document.title = title;
  document.querySelector('meta[name="description"]')?.setAttribute("content", description);
  document.querySelector('link[rel="canonical"]')?.setAttribute("href", window.location.href);
}

function renderError(message) {
  root.innerHTML = `
    <section class="cube-route-message" aria-labelledby="cube-route-error-title">
      <p class="cube-route-kicker">Cube unavailable</p>
      <h1 id="cube-route-error-title">We couldn’t find that cube.</h1>
      <p>${message}</p>
      <a class="cube-route-secondary-action" href="/">Return to cubacadabra</a>
    </section>`;
}

function renderCube(cube) {
  const creator = cube.creator ? `@${cube.creator}` : "an independent creator";
  const playPath = typeof cube.playPath === "string"
    ? cube.playPath
    : `/?game=${encodeURIComponent(cube.id)}`;
  setMeta(cube);
  root.innerHTML = `
    <section class="cube-route-hero" aria-labelledby="cube-route-title">
      <div class="cube-route-hero-art" aria-hidden="true">
        <span class="cube-route-orbit cube-route-orbit-one"></span>
        <span class="cube-route-orbit cube-route-orbit-two"></span>
        <span class="cube-route-art-cube"><i></i><i></i><i></i></span>
      </div>
      <div class="cube-route-copy">
        <p class="cube-route-kicker">Playable cube</p>
        <h1 id="cube-route-title">${escapeHtml(cube.displayName)}</h1>
        <p class="cube-route-byline">Created by <strong>${escapeHtml(creator)}</strong></p>
        <p class="cube-route-description">Step into this cubacadabra world and see what its creator built.</p>
        <a class="cube-route-primary-action" href="${escapeAttribute(playPath)}">
          Enter the cube <span aria-hidden="true">↗</span>
        </a>
      </div>
      <dl class="cube-route-meta">
        <div><dt>Cube ID</dt><dd>${escapeHtml(cube.id)}</dd></div>
        <div><dt>Version</dt><dd>${escapeHtml(cube.version)}</dd></div>
      </dl>
    </section>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

async function loadCube(cubeId) {
  const response = await fetch(backendApiUrl(`/cubes/${encodeURIComponent(cubeId)}`), {
    headers: { Accept: "application/json" },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.cube) {
    throw new Error(result?.error || "cube_not_found");
  }
  return result.cube;
}

async function start() {
  const cubeId = cubeIdFromPath();
  if (!cubeId) {
    renderError("Cube links use a lowercase ID with letters, numbers, and single dashes.");
    return;
  }

  try {
    renderCube(await loadCube(cubeId));
  } catch (error) {
    console.error(error);
    renderError("The cube may have been removed, or it may not have been published yet.");
  }
}

start();
