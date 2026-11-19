import type { AlertPath, AlertStatus } from "@abrigo/shared";

export const rooms = {
  conversation: (id: string) => `conversation:${id}`,
  anon: (sessionId: string) => `anon:${sessionId}`,
  user: (userId: string) => `user:${userId}`,
  helper: (helperId: string) => `helper:${helperId}`,
  /** Ayudantes conectados con esa especialidad: refrescan la lista de alertas abiertas. */
  helpersOf: (path: AlertPath) => `helpers:${path}`,
};

export interface ChatMessageEvent {
  id: string;
  conversationId: string;
  sender: "anon" | "helper" | "system";
  body: string;
  createdAt: string;
  clientId?: string;
}

export interface AlertUpdateEvent {
  alertId: string;
  status: AlertStatus;
  conversationId?: string | null;
  reason?: string | null;
  /** Novedades del escalado para explicarle a la persona qué está pasando. */
  escalation?: { level: number; widenedGender?: boolean; stillSearching?: boolean };
}
