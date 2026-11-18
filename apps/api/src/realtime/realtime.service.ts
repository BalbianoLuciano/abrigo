import { ALERT_PATHS } from "@abrigo/shared";
import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";
import { Emitter } from "@socket.io/redis-emitter";
import type { Redis } from "ioredis";
import { REDIS } from "../infra/tokens.js";
import { rooms, type AlertUpdateEvent, type ChatMessageEvent } from "./events.js";

/**
 * Emite eventos a los sockets a través de Redis, así funciona igual desde la API
 * (varias instancias) y desde el worker.
 */
@Injectable()
export class RealtimeService implements OnModuleDestroy {
  private readonly client: Redis;
  private readonly emitter: Emitter;

  constructor(@Inject(REDIS) redis: Redis) {
    this.client = redis.duplicate();
    this.emitter = new Emitter(this.client);
  }

  onModuleDestroy() {
    this.client.disconnect();
  }

  message(event: ChatMessageEvent) {
    this.emitter.to(rooms.conversation(event.conversationId)).emit("message", event);
  }

  conversationClosed(conversationId: string, by: "anon" | "helper" | "system", reason?: string) {
    this.emitter
      .to(rooms.conversation(conversationId))
      .emit("closed", { conversationId, by, reason: reason ?? null });
    this.emitter
      .in(rooms.conversation(conversationId))
      .socketsLeave(rooms.conversation(conversationId));
  }

  alertUpdate(anonSessionId: string | null, event: AlertUpdateEvent) {
    if (anonSessionId) this.emitter.to(rooms.anon(anonSessionId)).emit("alert:update", event);
  }

  /** Avisa a los ayudantes conectados que la lista de alertas abiertas cambió. */
  alertListChanged() {
    for (const path of ALERT_PATHS)
      this.emitter.to(rooms.helpersOf(path)).emit("alerts:changed", {});
  }

  /** El ayudante sale de la sala de una conversación (por ejemplo, al liberarse la alerta). */
  removeHelperFromConversation(helperId: string, conversationId: string) {
    this.emitter.in(rooms.helper(helperId)).socketsLeave(rooms.conversation(conversationId));
  }

  disconnectAnon(sessionId: string) {
    this.emitter.in(rooms.anon(sessionId)).disconnectSockets(true);
  }

  disconnectUser(userId: string) {
    this.emitter.in(rooms.user(userId)).disconnectSockets(true);
  }
}
