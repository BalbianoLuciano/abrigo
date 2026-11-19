import { useQuery } from "@tanstack/react-query";
import { getAnonToken, request, setAnonToken } from "./api";
import { closeSocket } from "./socket";

export interface PublicAlert {
  id: string;
  path: "mental_health" | "violence";
  status: "open" | "claimed" | "active" | "closed";
  dangerNow: "yes" | "unsure" | "no";
  escalationLevel: number;
  helperGenderPref: "woman" | "any" | null;
  createdAt: string;
  closeReason: string | null;
  conversationId: string | null;
}

/** Pedido actual de la persona (si tiene sesión). No crea sesión por sí solo. */
export function useCurrentAlert() {
  return useQuery({
    queryKey: ["current-alert"],
    queryFn: async () => {
      if (!(await getAnonToken())) return null;
      try {
        const res = await request<{ alert: PublicAlert | null }>("GET", "/v1/alerts/current", {
          auth: "anon",
        });
        return res.alert;
      } catch {
        return null;
      }
    },
  });
}

/** "Borrar todo": servidor primero (si hay sesión), después el dispositivo. */
export async function eraseEverything() {
  if (await getAnonToken()) {
    try {
      await request("DELETE", "/v1/anon/session", { auth: "anon" });
    } catch {
      // Aunque el servidor no responda, el dispositivo queda limpio.
    }
  }
  closeSocket();
  await setAnonToken(null);
}
