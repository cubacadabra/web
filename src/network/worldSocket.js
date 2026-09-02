import { backendConfig } from "../config/clientConfig.js";

const PLAYER_ID_STORAGE_KEY = "cubacadabra.player-id";
const USERNAME_STORAGE_KEY = "cubacadabra.username";
const USERNAME_MAX_LENGTH = 24;
const RECONNECT_BASE_DELAY = 750;
const RECONNECT_MAX_DELAY = 8_000;
const MOVE_SEND_INTERVAL_MS = 1000 / 12;
const MOVE_POSITION_EPSILON = 0.01;
const MOVE_YAW_EPSILON = 0.01;

function movesAreMeaningfullyDifferent(previousMove, nextMove) {
  if (!previousMove) return true;

  return previousMove.moving !== nextMove.moving
    || previousMove.sprinting !== nextMove.sprinting
    || Math.abs(previousMove.x - nextMove.x) > MOVE_POSITION_EPSILON
    || Math.abs(previousMove.y - nextMove.y) > MOVE_POSITION_EPSILON
    || Math.abs(previousMove.z - nextMove.z) > MOVE_POSITION_EPSILON
    || Math.abs(previousMove.yaw - nextMove.yaw) > MOVE_YAW_EPSILON;
}

function createPlayerId() {
  const randomId = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `web-${randomId}`;
}

function getPlayerId() {
  try {
    const stored = localStorage.getItem(PLAYER_ID_STORAGE_KEY);
    if (stored) return stored;

    const playerId = createPlayerId();
    localStorage.setItem(PLAYER_ID_STORAGE_KEY, playerId);
    return playerId;
  } catch {
    return createPlayerId();
  }
}

function platformLabel(playerId) {
  if (playerId.startsWith("ios-")) return "iOS";
  if (playerId.startsWith("web-")) return "Web";
  if (playerId.startsWith("android-")) return "Android";
  return "Player";
}

export function defaultUsernameForPlayer(playerId) {
  return `${platformLabel(playerId)} Player ${playerId.slice(-4).toUpperCase()}`;
}

function normalizeUsername(value) {
  if (typeof value !== "string") return null;
  const username = value.trim().replace(/\s+/g, " ");
  if (
    username.length < 2
    || username.length > USERNAME_MAX_LENGTH
    || !/^[A-Za-z0-9 _-]+$/.test(username)
  ) return null;
  return username;
}

function getUsername(playerId) {
  const fallback = defaultUsernameForPlayer(playerId);
  try {
    return normalizeUsername(localStorage.getItem(USERNAME_STORAGE_KEY)) || fallback;
  } catch {
    return fallback;
  }
}

function storeUsername(username) {
  try {
    localStorage.setItem(USERNAME_STORAGE_KEY, username);
  } catch {
    // The live connection still owns the current name when storage is unavailable.
  }
}

function createSocketUrl(worldId, playerId) {
  const url = new URL(backendConfig.webSocketUrl);
  const basePath = url.pathname.replace(/\/$/, "");
  url.pathname = `${basePath}/world/${encodeURIComponent(worldId)}`;
  url.searchParams.set("player_id", playerId);
  return url;
}

export function createWorldSocket({ onEvent, onMove, onStatusChange }) {
  const playerId = getPlayerId();
  let username = getUsername(playerId);
  let pendingUsername = username;
  let usernameResultHandler = null;
  let socket = null;
  let worldId = null;
  let reconnectTimer = 0;
  let reconnectAttempt = 0;
  let lastMoveSentAt = Number.NEGATIVE_INFINITY;
  let lastSentMove = null;
  let generation = 0;
  let destroyed = false;

  function setStatus(status) {
    onStatusChange?.(status);
  }

  function clearReconnectTimer() {
    if (!reconnectTimer) return;
    window.clearTimeout(reconnectTimer);
    reconnectTimer = 0;
  }

  function closeCurrentSocket() {
    const current = socket;
    socket = null;
    if (current && current.readyState < WebSocket.CLOSING) {
      current.close(1000, "Changing world");
    }
  }

  function openSocket(expectedGeneration) {
    if (destroyed || !worldId || expectedGeneration !== generation) return;

    setStatus(reconnectAttempt > 0 ? "reconnecting" : "connecting");
    const nextSocket = new WebSocket(createSocketUrl(worldId, playerId));
    socket = nextSocket;

    nextSocket.addEventListener("open", () => {
      if (socket !== nextSocket || expectedGeneration !== generation) return;
      reconnectAttempt = 0;
      lastMoveSentAt = Number.NEGATIVE_INFINITY;
      lastSentMove = null;
      setStatus("connected");
      if (pendingUsername) {
        try {
          nextSocket.send(JSON.stringify({
            type: "set_username",
            username: pendingUsername,
          }));
        } catch {
          // The close handler will schedule a reconnect if the socket is gone.
        }
      }
    });

    nextSocket.addEventListener("message", (message) => {
      if (socket !== nextSocket || expectedGeneration !== generation) return;

      try {
        const event = JSON.parse(message.data);
        if (event?.type === "move") {
          if (
            typeof event.id !== "string"
            || ![event.x, event.y, event.z, event.yaw].every(Number.isFinite)
          ) {
            return;
          }
          onMove?.({
            ...event,
            isSelf: event.id === playerId,
          });
          return;
        }
        if (
          event?.type !== "player_join"
          && event?.type !== "player_leave"
          && event?.type !== "player_name"
          && event?.type !== "username_updated"
          && event?.type !== "username_error"
        ) {
          return;
        }
        if (event.type === "username_updated" || event.type === "username_error") {
          if (event.type === "username_updated" && typeof event.username === "string") {
            username = event.username;
            pendingUsername = event.username;
            storeUsername(event.username);
          } else if (event.type === "username_error") {
            pendingUsername = username;
          }
          usernameResultHandler?.(event);
          return;
        }
        if (typeof event.id !== "string") return;
        if (event.type === "player_name" && typeof event.username !== "string") return;
        onEvent?.({
          ...event,
          isSelf: event.id === playerId,
        });
      } catch {
        // Ignore protocol messages this client version does not understand.
      }
    });

    nextSocket.addEventListener("close", () => {
      if (socket !== nextSocket || expectedGeneration !== generation) return;
      socket = null;
      if (destroyed || !worldId) return;

      reconnectAttempt += 1;
      setStatus("reconnecting");
      const delay = Math.min(
        RECONNECT_BASE_DELAY * (2 ** (reconnectAttempt - 1)),
        RECONNECT_MAX_DELAY,
      );
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = 0;
        openSocket(expectedGeneration);
      }, delay);
    });
  }

  function connect(nextWorldId) {
    if (typeof nextWorldId !== "string" || !nextWorldId.trim()) return;
    const normalizedWorldId = nextWorldId.trim();
    if (
      normalizedWorldId === worldId
      && socket
      && socket.readyState < WebSocket.CLOSING
    ) {
      return;
    }

    generation += 1;
    clearReconnectTimer();
    closeCurrentSocket();
    worldId = normalizedWorldId;
    reconnectAttempt = 0;
    lastMoveSentAt = Number.NEGATIVE_INFINITY;
    lastSentMove = null;
    openSocket(generation);
  }

  function sendMove({ x, y, z, yaw, moving, sprinting }) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;

    const event = {
      type: "move",
      x,
      y,
      z,
      yaw,
      moving: Boolean(moving),
      sprinting: Boolean(sprinting),
    };
    if (!movesAreMeaningfullyDifferent(lastSentMove, event)) return;

    const now = performance.now();
    if (now - lastMoveSentAt < MOVE_SEND_INTERVAL_MS) return;

    try {
      socket.send(JSON.stringify(event));
      lastMoveSentAt = now;
      lastSentMove = event;
    } catch {
      // The close handler will schedule a reconnect if the socket is gone.
    }
  }

  function setUsername(nextUsername) {
    const normalizedUsername = normalizeUsername(nextUsername);
    if (!normalizedUsername) {
      usernameResultHandler?.({ type: "username_error", code: "invalid_username" });
      return false;
    }

    pendingUsername = normalizedUsername;
    if (!socket || socket.readyState !== WebSocket.OPEN) return true;

    try {
      socket.send(JSON.stringify({
        type: "set_username",
        username: normalizedUsername,
      }));
    } catch {
      return true;
    }
    return true;
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    generation += 1;
    worldId = null;
    clearReconnectTimer();
    closeCurrentSocket();
    setStatus("disconnected");
  }

  return {
    playerId,
    get username() {
      return username;
    },
    get onUsernameResult() {
      return usernameResultHandler;
    },
    set onUsernameResult(handler) {
      usernameResultHandler = handler;
    },
    connect,
    sendMove,
    setUsername,
    destroy,
  };
}
