import { io } from "socket.io-client";

const SIGNAL_URL = import.meta.env.VITE_SIGNAL_URL || "https://dev-api.vtalix.com/api/v1/signalling";
const DEFAULT_SOCKET_PATH = "/socket.io";

function getSocketConfig(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    const basePath = parsed.pathname && parsed.pathname !== "/" ? parsed.pathname.replace(/\/+$/, "") : "";

    return {
      url: parsed.origin,
      path: `${basePath}${DEFAULT_SOCKET_PATH}`,
    };
  } catch (_error) {
    return {
      url: rawUrl,
      path: DEFAULT_SOCKET_PATH,
    };
  }
}

const socketConfig = getSocketConfig(SIGNAL_URL);

export const socket = io(socketConfig.url, {
  path: socketConfig.path,
  transports: ["polling", "websocket"],
  upgrade: true,
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  randomizationFactor: 0.5,
  timeout: 20000,
});

// attach token from sessionStorage before connecting (if present)
// NOTE: disabled — this repo uses route params / explicit room ids instead of
// relying on auth token-derived room info. Keep function stub if needed later.
const attachAuth = () => {
  // intentionally no-op
};

// attachAuth(); // disabled to prefer route params over token-derived data

socket.on("connect", () => {
  console.log("[socket] connected", {
    socketId: socket.id,
    transport: socket.io.engine.transport.name,
    url: socketConfig.url,
    path: socketConfig.path,
  });
});

socket.on("reconnect_attempt", (n) => {
  console.log("[socket] reconnect attempt", n);
});

socket.on("reconnect", (n) => {
  console.log("[socket] reconnected", n);
});

socket.on("disconnect", (reason) => {
  console.log("[socket] disconnected", reason);
});

socket.on("connect_error", (error) => {
  console.log("[socket] connect_error", {
    message: error.message,
    description: error.description || null,
    context: error.context || null,
    url: socketConfig.url,
    path: socketConfig.path,
  });
});

export function joinRoom(payload) {
  socket.emit("join-room", payload);
}

export function sendChat(roomId, message, meta = {}) {
  socket.emit("chat-message", { roomId, message, meta });
}
