import { useCallback, useEffect, useRef, useState } from "react";
import { request } from "./api";
import { getSocket } from "./socket";

export interface ChatMessage {
  id: string;
  conversationId: string;
  sender: "anon" | "helper" | "system";
  body: string;
  createdAt: string;
  clientId?: string;
  pending?: boolean;
}

export interface ConversationSummary {
  id: string;
  alertId: string;
  startedAt: string;
  endedAt: string | null;
  helper: { firstName: string; profession: string } | null;
}

/**
 * Estado en vivo de una conversación: historial, mensajes nuevos, "escribiendo"
 * y cierre. Envía por socket y, si falla, por HTTP.
 */
export function useConversation(conversationId: string, kind: "anon" | "staff") {
  const [summary, setSummary] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [otherTyping, setOtherTyping] = useState(false);
  const [closed, setClosed] = useState<{ by: string; reason: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const me = kind === "anon" ? "anon" : "helper";

  const upsert = useCallback((m: ChatMessage) => {
    setMessages((prev) => {
      const idx = prev.findIndex((p) => p.id === m.id || (m.clientId && p.clientId === m.clientId));
      if (idx === -1) return [...prev, m];
      const next = prev.slice();
      next[idx] = { ...m, pending: false };
      return next;
    });
  }, []);

  useEffect(() => {
    let alive = true;
    const cleanups: (() => void)[] = [];

    async function load() {
      try {
        const [s, history] = await Promise.all([
          request<ConversationSummary>("GET", `/v1/conversations/${conversationId}`, {
            auth: kind,
          }),
          request<{ messages: ChatMessage[] }>(
            "GET",
            `/v1/conversations/${conversationId}/messages`,
            {
              auth: kind,
            },
          ),
        ]);
        if (!alive) return;
        setSummary(s);
        setMessages(history.messages);
        if (s.endedAt) setClosed({ by: "system", reason: null });
      } catch {
        if (alive) setError("No pudimos cargar la conversación.");
      }
    }

    void (async () => {
      const socket = await getSocket(kind);
      const join = () => void socket.emitWithAck("join", { conversationId }).catch(() => undefined);
      const onMessage = (m: ChatMessage) => {
        if (m.conversationId !== conversationId) return;
        upsert(m);
        if (m.sender !== me) setOtherTyping(false);
      };
      const onTyping = (e: { conversationId: string; sender: string }) => {
        if (e.conversationId !== conversationId || e.sender === me) return;
        setOtherTyping(true);
        if (typingTimer.current) clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setOtherTyping(false), 4000);
      };
      const onClosed = (e: { conversationId: string; by: string; reason: string | null }) => {
        if (e.conversationId === conversationId) setClosed({ by: e.by, reason: e.reason });
      };
      socket.on("connect", join);
      socket.on("connect", load);
      socket.on("message", onMessage);
      socket.on("typing", onTyping);
      socket.on("closed", onClosed);
      if (socket.connected) join();
      cleanups.push(() => {
        socket.off("connect", join);
        socket.off("connect", load);
        socket.off("message", onMessage);
        socket.off("typing", onTyping);
        socket.off("closed", onClosed);
      });
    })();
    void load();
    return () => {
      alive = false;
      cleanups.forEach((c) => c());
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, [conversationId, kind, me, upsert]);

  const send = useCallback(
    async (body: string) => {
      const clientId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      upsert({
        id: clientId,
        clientId,
        conversationId,
        sender: me,
        body,
        createdAt: new Date().toISOString(),
        pending: true,
      });
      try {
        const socket = await getSocket(kind);
        const ack = (await socket
          .timeout(8000)
          .emitWithAck("message", { conversationId, body, clientId })) as {
          ok: boolean;
          data?: ChatMessage;
          error?: string;
        };
        if (ack.ok && ack.data) return upsert(ack.data);
        throw new Error(ack.error ?? "socket");
      } catch {
        const saved = await request<ChatMessage>(
          "POST",
          `/v1/conversations/${conversationId}/messages`,
          {
            auth: kind,
            body: { body, clientId },
          },
        );
        upsert(saved);
      }
    },
    [conversationId, kind, me, upsert],
  );

  const notifyTyping = useCallback(() => {
    void getSocket(kind).then((s) => s.emit("typing", { conversationId }));
  }, [conversationId, kind]);

  return { summary, messages, otherTyping, closed, error, send, notifyTyping, setClosed };
}
