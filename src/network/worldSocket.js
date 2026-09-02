import { backendConfig } from "../config/clientConfig.js";

const PLAYER_ID_STORAGE_KEY = "cubacadabra.player-id";
const RECONNECT_BASE_DELAY = 750;
const RECONNECT_MAX_DELAY = 8_000;

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

function createSocketUrl(worldId, playerId) {
  const url = new URL(backendConfig.webSocketUrl);
  const basePath = url.pathname.replace(/\/$/, "");
  url.pathname = `${basePath}/world/${encodeURIComponent(worldId)}`;
  url.searchParams.set("player_id", playerId);
  return url;
}

export function createWorldSocket({ onEvent, onMove, onStatusChange }) {
  const playerId = getPlayerId();
  let socket = null;
  let worldId = null;
  let reconnectTimer = 0;
  let reconnectAttempt = 0;
  let lastMoveSentAt = Number.NEGATIVE_INFINITY;
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
      setStatus("connected");
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
        if (event?.type !== "player_join" && event?.type !== "player_leave") {
          return;
        }
        if (typeof event.id !== "string") return;
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
    openSocket(generation);
  }

  function sendMove({ x, y, z, yaw, moving, sprinting }) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    const now = performance.now();
    if (now - lastMoveSentAt < 50) return;

    const event = {
      type: "move",
      x,
      y,
      z,
      yaw,
      moving: Boolean(moving),
      sprinting: Boolean(sprinting),
    };
    try {
      socket.send(JSON.stringify(event));
      lastMoveSentAt = now;
    } catch {
      // The close handler will schedule a reconnect if the socket is gone.
    }
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
    connect,
    sendMove,
    destroy,
  };
}
