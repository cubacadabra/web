import { backendApiUrl } from "../config/clientConfig.js";
import "./sudoCadabra.css";

const REFRESH_INTERVAL_MS = 10_000;

function formatNumber(value) {
  return new Intl.NumberFormat().format(value ?? 0);
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(milliseconds) {
  if (milliseconds === null || milliseconds === undefined) return "—";
  if (milliseconds <= 0) return "expired";

  const totalSeconds = Math.ceil(milliseconds / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  return `${seconds}s`;
}

function makeCell(value, className = "") {
  const cell = document.createElement("td");
  if (className) cell.className = className;
  cell.textContent = value;
  return cell;
}

function makeCountdownCell(timeoutAt) {
  const cell = makeCell(
    timeoutAt ? formatDuration(timeoutAt - Date.now()) : "—",
    "sudo-time-left",
  );
  if (timeoutAt) cell.dataset.timeoutAt = String(timeoutAt);
  return cell;
}

function makeStatus(status) {
  const statusElement = document.createElement("span");
  statusElement.className = `sudo-status sudo-status-${status}`;
  statusElement.textContent = status;
  return statusElement;
}

function makeMetric(label, value, detail, accent = "") {
  const card = document.createElement("article");
  card.className = `sudo-metric ${accent ? `sudo-metric-${accent}` : ""}`;

  const labelElement = document.createElement("span");
  labelElement.className = "sudo-metric-label";
  labelElement.textContent = label;
  const valueElement = document.createElement("strong");
  valueElement.className = "sudo-metric-value";
  valueElement.textContent = value;
  const detailElement = document.createElement("span");
  detailElement.className = "sudo-metric-detail";
  detailElement.textContent = detail;
  card.append(labelElement, valueElement, detailElement);
  return card;
}

function createTableRow(cells) {
  const row = document.createElement("tr");
  cells.forEach((cell) => {
    row.append(cell instanceof Node ? cell : makeCell(cell));
  });
  return row;
}

function mountLayout() {
  document.documentElement.classList.add("sudo-document");
  document.body.className = "sudo-page";
  document.body.innerHTML = `
    <div class="sudo-shell">
      <aside class="sudo-sidebar">
        <a class="sudo-brand" href="/" aria-label="Back to Cubacadabra">
          <span class="sudo-brand-mark" aria-hidden="true"><span></span></span>
          <span>
            <strong>sudo-cadabra</strong>
            <small>capacity console</small>
          </span>
        </a>

        <div class="sudo-sidebar-rule"></div>
        <p class="sudo-nav-label">Monitor</p>
        <nav class="sudo-nav" aria-label="Admin sections">
          <a class="is-active" href="#overview" data-section="overview">
            <span class="sudo-nav-index">01</span>
            <span>Overview</span>
          </a>
          <a href="#lobbies" data-section="lobbies">
            <span class="sudo-nav-index">02</span>
            <span>Lobbies</span>
          </a>
          <a href="#games" data-section="games">
            <span class="sudo-nav-index">03</span>
            <span>Game instances</span>
          </a>
          <a href="#players" data-section="players">
            <span class="sudo-nav-index">04</span>
            <span>Player clocks</span>
          </a>
        </nav>

        <div class="sudo-sidebar-footer">
          <span class="sudo-live-mark"></span>
          <span>Open access · v0.1</span>
        </div>
      </aside>

      <main class="sudo-main">
        <div class="sudo-main-content">
        <header class="sudo-header">
          <div>
            <p class="sudo-eyebrow">Operations / capacity</p>
            <h1>Sudo-cadabra</h1>
            <p class="sudo-subtitle">A live view of the tiny cloud behind the worlds.</p>
          </div>
          <div class="sudo-header-actions">
            <div class="sudo-sync-state">
              <span class="sudo-sync-dot" id="sudo-sync-dot"></span>
              <span id="sudo-sync-copy">Connecting to telemetry</span>
            </div>
            <button class="sudo-refresh-button" id="sudo-refresh" type="button">Refresh</button>
          </div>
        </header>

        <div class="sudo-metrics" id="sudo-metrics" aria-live="polite"></div>

        <section class="sudo-panel" id="overview" data-panel="overview">
          <div class="sudo-panel-header">
            <div>
              <p class="sudo-eyebrow">Inventory</p>
              <h2>Instance ledger</h2>
            </div>
            <span class="sudo-panel-note" id="sudo-generated-at">Waiting for first read</span>
          </div>
          <div class="sudo-table-wrap">
            <table class="sudo-table" id="sudo-instance-table">
              <caption class="sudo-visually-hidden">All lobby and game instances</caption>
              <thead>
                <tr>
                  <th>Kind</th>
                  <th>World</th>
                  <th>Instance</th>
                  <th>Status</th>
                  <th>Players</th>
                  <th>Sockets</th>
                  <th>Reserved</th>
                  <th>Capacity</th>
                  <th>Created</th>
                  <th>Last used</th>
                  <th>Next timeout</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="sudo-empty" id="sudo-instance-empty" hidden>No instance records yet.</div>
        </section>

        <section class="sudo-panel" id="lobbies" data-panel="lobbies">
          <div class="sudo-panel-header">
            <div>
              <p class="sudo-eyebrow">Lobby allocation</p>
              <h2>Lobby capacity</h2>
            </div>
            <span class="sudo-panel-note">Maximum three lobby instances</span>
          </div>
          <div class="sudo-table-wrap">
            <table class="sudo-table" id="sudo-lobby-table">
              <caption class="sudo-visually-hidden">Lobby instance details</caption>
              <thead>
                <tr>
                  <th>Lobby</th>
                  <th>Status</th>
                  <th>Players</th>
                  <th>Reservations</th>
                  <th>Instance age</th>
                  <th>Nearest timeout</th>
                  <th>Player clocks</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
        </section>

        <section class="sudo-panel" id="games" data-panel="games">
          <div class="sudo-panel-header">
            <div>
              <p class="sudo-eyebrow">World allocation</p>
              <h2>Game capacity</h2>
            </div>
            <span class="sudo-panel-note">Maximum three game instances</span>
          </div>
          <div class="sudo-table-wrap">
            <table class="sudo-table" id="sudo-game-table">
              <caption class="sudo-visually-hidden">Game instance details</caption>
              <thead>
                <tr>
                  <th>World</th>
                  <th>Instance</th>
                  <th>Status</th>
                  <th>Players</th>
                  <th>Reservations</th>
                  <th>Capacity</th>
                  <th>Nearest timeout</th>
                  <th>Player clocks</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
        </section>

        <section class="sudo-panel" id="players" data-panel="players">
          <div class="sudo-panel-header">
            <div>
              <p class="sudo-eyebrow">Eviction monitor</p>
              <h2>Player clocks</h2>
            </div>
            <span class="sudo-panel-note" id="sudo-timeout-note">Idle timeout: —</span>
          </div>
          <div class="sudo-table-wrap">
            <table class="sudo-table sudo-player-table" id="sudo-player-table">
              <caption class="sudo-visually-hidden">Player activity and idle timeout details</caption>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Kind</th>
                  <th>World</th>
                  <th>Instance</th>
                  <th>State</th>
                  <th>Sockets</th>
                  <th>Last activity</th>
                  <th>Timeout at</th>
                  <th>Time left</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="sudo-empty" id="sudo-player-empty" hidden>No connected players.</div>
        </section>

        <div class="sudo-error" id="sudo-error" hidden></div>
        </div>
      </main>
    </div>
  `;
}

function allWorlds(payload) {
  return [payload.lobby, ...(payload.games ?? [])].filter(Boolean);
}

function allInstances(payload) {
  return allWorlds(payload).flatMap((world) => (
    (world.instances ?? []).map((instance) => ({ world, instance }))
  ));
}

function renderMetrics(payload) {
  const worlds = allWorlds(payload);
  const lobby = payload.lobby;
  const games = payload.games ?? [];
  const activeLobbies = lobby?.activeInstanceCount ?? 0;
  const activeGames = games.reduce(
    (total, world) => total + (world.activeInstanceCount ?? 0),
    0,
  );
  const lobbyPlayers = lobby?.playerCount ?? 0;
  const gamePlayers = games.reduce(
    (total, world) => total + (world.playerCount ?? 0),
    0,
  );
  const reserved = worlds.reduce(
    (total, world) => total + (world.reservationCount ?? 0),
    0,
  );
  const lobbyLimit = lobby?.maxInstances ?? 3;
  const gameLimit = games.reduce(
    (total, world) => total + (world.maxInstances ?? 3),
    0,
  );

  const metrics = [
    makeMetric("Active lobbies", `${activeLobbies} / ${lobbyLimit}`, `${formatNumber(lobbyPlayers)} connected players`, "lobby"),
    makeMetric("Game instances", `${activeGames} / ${gameLimit}`, `${formatNumber(gamePlayers)} connected players`, "game"),
    makeMetric("Pending reservations", formatNumber(reserved), "handshakes in allocation", "warm"),
    makeMetric("Idle timeout", formatDuration(payload.idleTimeoutMs), `sweep every ${formatDuration(payload.idleSweepIntervalMs)}`, "cool"),
  ];
  document.querySelector("#sudo-metrics").replaceChildren(...metrics);
}

function renderInstanceLedger(payload) {
  const body = document.querySelector("#sudo-instance-table tbody");
  const rows = allInstances(payload).map(({ world, instance }) => {
    const timeout = instance.nearestTimeoutAt;
    return createTableRow([
      makeCell(world.kind, "sudo-kind"),
      makeCell(world.worldId, "sudo-mono"),
      makeCell(instance.instanceId, "sudo-mono"),
      makeStatus(instance.status),
      makeCell(formatNumber(instance.playerCount)),
      makeCell(formatNumber(instance.connectionCount)),
      makeCell(formatNumber(instance.reservationCount)),
      makeCell(`${instance.playerCount} / ${world.maxPlayersPerInstance}`),
      makeCell(formatDate(instance.createdAt), "sudo-muted"),
      makeCell(formatDate(instance.lastUsedAt), "sudo-muted"),
      makeCell(timeout ? formatDate(timeout) : "—", "sudo-mono"),
    ]);
  });
  body.replaceChildren(...rows);
  document.querySelector("#sudo-instance-empty").hidden = rows.length > 0;
}

function renderCapacityTable(selector, worlds, isLobby) {
  const body = document.querySelector(`${selector} tbody`);
  const rows = allInstances({ lobby: isLobby ? worlds[0] : null, games: isLobby ? [] : worlds })
    .map(({ world, instance }) => {
      const playerClocks = instance.players ?? [];
      const nearest = instance.nearestTimeoutAt;
      const cells = isLobby
        ? [
          makeCell(instance.instanceId, "sudo-mono"),
          makeStatus(instance.status),
          makeCell(`${instance.playerCount} / ${world.maxPlayersPerInstance}`),
          makeCell(formatNumber(instance.reservationCount)),
          makeCell(formatDuration(Date.now() - instance.createdAt)),
          makeCountdownCell(nearest),
          makeCell(formatNumber(playerClocks.length)),
        ]
        : [
          makeCell(world.worldId, "sudo-mono"),
          makeCell(instance.instanceId, "sudo-mono"),
          makeStatus(instance.status),
          makeCell(`${instance.playerCount} / ${world.maxPlayersPerInstance}`),
          makeCell(formatNumber(instance.reservationCount)),
          makeCell(`${instance.playerCount} / ${world.maxPlayersPerInstance}`),
          makeCountdownCell(nearest),
          makeCell(formatNumber(playerClocks.length)),
        ];
      return createTableRow(cells);
    });
  body.replaceChildren(...rows);
}

function renderPlayerClocks(payload) {
  const body = document.querySelector("#sudo-player-table tbody");
  const rows = allInstances(payload).flatMap(({ world, instance }) => (
    (instance.players ?? []).map((player) => {
      const timeoutAt = player.idleTimeoutAt;
      return createTableRow([
        makeCell(player.playerId, "sudo-mono"),
        makeCell(world.kind, "sudo-kind"),
        makeCell(world.worldId, "sudo-mono"),
        makeCell(instance.instanceId, "sudo-mono"),
        makeStatus(player.state),
        makeCell(formatNumber(player.connectionCount ?? 1)),
        makeCell(formatDate(player.lastActivityAt), "sudo-muted"),
        makeCell(timeoutAt ? formatDate(timeoutAt) : "—", "sudo-mono"),
        makeCountdownCell(timeoutAt),
      ]);
    })
  ));
  body.replaceChildren(...rows);
  document.querySelector("#sudo-player-empty").hidden = rows.length > 0;
}

function updateCountdowns() {
  document.querySelectorAll("[data-timeout-at]").forEach((element) => {
    const timeoutAt = Number(element.dataset.timeoutAt);
    element.textContent = formatDuration(timeoutAt - Date.now());
  });
}

function showError(message) {
  const error = document.querySelector("#sudo-error");
  error.textContent = message;
  error.hidden = false;
  document.querySelector("#sudo-sync-dot").classList.add("is-error");
}

function clearError() {
  const error = document.querySelector("#sudo-error");
  error.hidden = true;
  document.querySelector("#sudo-sync-dot").classList.remove("is-error");
}

function setSyncState(message, state = "live") {
  document.querySelector("#sudo-sync-copy").textContent = message;
  document.querySelector("#sudo-sync-dot").className = `sudo-sync-dot is-${state}`;
}

async function loadStatus() {
  setSyncState("Reading instance telemetry", "loading");
  try {
    const response = await fetch(backendApiUrl("/admin/status"), {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Telemetry returned ${response.status}`);
    const payload = await response.json();
    renderMetrics(payload);
    renderInstanceLedger(payload);
    renderCapacityTable("#sudo-lobby-table", [payload.lobby].filter(Boolean), true);
    renderCapacityTable("#sudo-game-table", payload.games ?? [], false);
    renderPlayerClocks(payload);
    document.querySelector("#sudo-generated-at").textContent = `Server read ${formatDate(payload.generatedAt)}`;
    document.querySelector("#sudo-timeout-note").textContent = `Idle timeout: ${formatDuration(payload.idleTimeoutMs)}`;
    setSyncState(`Live · updated ${formatDate(Date.now())}`, "live");
    clearError();
  } catch (error) {
    console.error(error);
    setSyncState("Telemetry unavailable", "error");
    showError("Could not read sudo-cadabra telemetry. The backend may be offline.");
  }
}

function bindNavigation() {
  document.querySelectorAll(".sudo-nav a").forEach((link) => {
    link.addEventListener("click", () => {
      document.querySelectorAll(".sudo-nav a").forEach((item) => {
        item.classList.toggle("is-active", item === link);
      });
    });
  });
}

export function mountSudoCadabra() {
  mountLayout();
  bindNavigation();
  document.querySelector("#sudo-refresh").addEventListener("click", loadStatus);
  loadStatus();
  window.setInterval(loadStatus, REFRESH_INTERVAL_MS);
  window.setInterval(updateCountdowns, 1_000);
}
