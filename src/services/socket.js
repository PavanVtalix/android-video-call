import { io } from "socket.io-client";

export const socket = io("https://back-signal.onrender.com/", {
  transports: ["websocket"],
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
});
