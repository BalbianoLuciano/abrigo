import { io, type Socket } from "socket.io-client";
import { getAnonToken, getStaffToken, setAnonToken } from "./api";
import { API_URL } from "./config";
import { onTeardown } from "./teardown";

let socket: Socket | null = null;
let socketKind: "anon" | "staff" | null = null;

export async function getSocket(kind: "anon" | "staff"): Promise<Socket> {
  if (socket && socketKind === kind) return socket;
  socket?.disconnect();
  // Se evalúa en cada (re)conexión: toma el token vigente aunque haya rotado.
  const auth = (cb: (data: object) => void) => {
    if (kind === "anon") void getAnonToken().then((t) => cb({ anonToken: t ?? "" }));
    else void getStaffToken().then((t) => cb({ sessionToken: t ?? "" }));
  };
  socket = io(API_URL, {
    auth,
    transports: ["websocket", "polling"],
    withCredentials: true,
    reconnectionDelayMax: 10_000,
  });
  socketKind = kind;
  socket.on("anon:token-rotated", ({ token }: { token: string }) => {
    void setAnonToken(token);
  });
  return socket;
}

export function closeSocket() {
  socket?.disconnect();
  socket = null;
  socketKind = null;
}

onTeardown(closeSocket);
