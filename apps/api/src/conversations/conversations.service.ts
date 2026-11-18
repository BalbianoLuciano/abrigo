import {
  alerts,
  and,
  asc,
  conversations,
  desc,
  eq,
  helpers,
  isNull,
  messages,
  reports,
  type Database,
} from "@abrigo/db";
import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { AlertTimersService } from "../alerts/alert-timers.service.js";
import { LifecycleService } from "../alerts/lifecycle.service.js";
import { AuditService } from "../audit/audit.service.js";
import type { Principal } from "../common/principal.js";
import { MessageCipher } from "../crypto/message-cipher.js";
import { DB } from "../infra/tokens.js";
import { PushService } from "../notifications/push.service.js";
import type { ChatMessageEvent } from "../realtime/events.js";
import { RealtimeService } from "../realtime/realtime.service.js";

export const MAX_MESSAGE_LENGTH = 4000;

type Conversation = typeof conversations.$inferSelect;

@Injectable()
export class ConversationsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(MessageCipher) private readonly cipher: MessageCipher,
    @Inject(LifecycleService) private readonly lifecycle: LifecycleService,
    @Inject(AlertTimersService) private readonly timers: AlertTimersService,
    @Inject(RealtimeService) private readonly realtime: RealtimeService,
    @Inject(PushService) private readonly push: PushService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  /** Devuelve la conversación si el principal participa en ella. */
  async forParticipant(conversationId: string, who: Principal): Promise<Conversation> {
    const [conv] = await this.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);
    if (!conv) throw new NotFoundException("No encontramos esa conversación");
    const allowed =
      who.kind === "anon"
        ? conv.anonSessionId === who.sessionId
        : who.helperId !== null && conv.helperId === who.helperId;
    if (!allowed) throw new ForbiddenException("No participás de esta conversación");
    return conv;
  }

  async summary(conversationId: string, who: Principal) {
    const conv = await this.forParticipant(conversationId, who);
    const [helper] = await this.db
      .select({ firstName: helpers.firstName, profession: helpers.profession })
      .from(helpers)
      .where(eq(helpers.id, conv.helperId))
      .limit(1);
    return {
      id: conv.id,
      alertId: conv.alertId,
      startedAt: conv.startedAt.toISOString(),
      endedAt: conv.endedAt?.toISOString() ?? null,
      // Quien pide ayuda ve nombre de pila y rol verificado; nunca apellido ni matrícula.
      helper: helper ? { firstName: helper.firstName, profession: helper.profession } : null,
    };
  }

  /** Conversaciones en curso del ayudante (para su panel). */
  async listActiveForHelper(helperId: string) {
    const rows = await this.db
      .select({
        id: conversations.id,
        alertId: conversations.alertId,
        path: alerts.path,
        dangerNow: alerts.dangerNow,
        safeTimeToWrite: alerts.safeTimeToWrite,
        status: alerts.status,
        startedAt: conversations.startedAt,
        lastMessageAt: conversations.lastMessageAt,
      })
      .from(conversations)
      .innerJoin(alerts, eq(alerts.id, conversations.alertId))
      .where(and(eq(conversations.helperId, helperId), isNull(conversations.endedAt)))
      .orderBy(desc(conversations.startedAt));
    return rows.map((r) => ({
      ...r,
      startedAt: r.startedAt.toISOString(),
      lastMessageAt: r.lastMessageAt?.toISOString() ?? null,
    }));
  }

  async listMessages(conversationId: string, who: Principal): Promise<ChatMessageEvent[]> {
    await this.forParticipant(conversationId, who);
    const rows = await this.db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt));
    return Promise.all(
      rows.map(async (m) => ({
        id: m.id,
        conversationId,
        sender: m.sender,
        body: await this.cipher.open(
          { ciphertext: m.ciphertext, nonce: m.nonce, keyVersion: m.keyVersion },
          conversationId,
        ),
        createdAt: m.createdAt.toISOString(),
      })),
    );
  }

  async send(conversationId: string, who: Principal, rawBody: string, clientId?: string) {
    const body = rawBody.trim();
    if (!body) throw new UnprocessableEntityException("El mensaje está vacío");
    if (body.length > MAX_MESSAGE_LENGTH) {
      throw new UnprocessableEntityException("El mensaje es demasiado largo");
    }
    const conv = await this.forParticipant(conversationId, who);
    if (conv.endedAt) throw new UnprocessableEntityException("La conversación terminó");

    const sender = who.kind === "anon" ? "anon" : "helper";
    const sealed = await this.cipher.seal(body, conversationId);
    const [row] = await this.db
      .insert(messages)
      .values({ conversationId, sender, ...sealed })
      .returning({ id: messages.id, createdAt: messages.createdAt });
    await this.db
      .update(conversations)
      .set({ lastMessageAt: row!.createdAt })
      .where(eq(conversations.id, conversationId));

    const event: ChatMessageEvent = {
      id: row!.id,
      conversationId,
      sender,
      body,
      createdAt: row!.createdAt.toISOString(),
      ...(clientId ? { clientId } : {}),
    };
    this.realtime.message(event);

    if (sender === "helper") {
      await this.lifecycle.markFirstHelperMessage(conversationId);
      if (conv.anonSessionId) {
        // Aviso discreto: sin contenido ni nombre.
        await this.push.notifyAnon(conv.anonSessionId, {
          title: "Abrigo",
          body: "Tenés un mensaje nuevo",
          url: `/chat/${conversationId}`,
        });
      }
    }
    return event;
  }

  async close(conversationId: string, who: Principal, helperNote?: string) {
    const conv = await this.forParticipant(conversationId, who);
    if (who.kind === "staff" && helperNote?.trim()) {
      const sealed = await this.cipher.seal(helperNote.trim(), `note:${conversationId}`);
      await this.db
        .update(conversations)
        .set({
          helperNoteCiphertext: sealed.ciphertext,
          helperNoteNonce: sealed.nonce,
          helperNoteKeyVersion: sealed.keyVersion,
        })
        .where(eq(conversations.id, conversationId));
    }
    if (conv.endedAt) return;
    await this.lifecycle.closeConversation(
      conversationId,
      who.kind === "anon" ? "anon" : "helper",
      "closed",
    );
  }

  async report(conversationId: string, who: Principal, reason: string, details?: string) {
    await this.forParticipant(conversationId, who);
    const reporter = who.kind === "anon" ? "anon" : "helper";
    const [report] = await this.db
      .insert(reports)
      .values({ conversationId, reporter, reason, details: details ?? null })
      .returning({ id: reports.id });
    await this.audit.record({
      actorType: reporter,
      actorId: who.kind === "staff" ? who.helperId : null,
      action: "conversation.reported",
      targetType: "conversation",
      targetId: conversationId,
      metadata: { reason, reportId: report!.id },
    });
    return { id: report!.id };
  }

  /** Inactividad de 24 h: si hubo mensajes después, se reprograma; si no, se cierra. */
  async checkInactivity(conversationId: string, inactivityMs: number) {
    const [conv] = await this.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);
    if (!conv || conv.endedAt) return;
    const last = (conv.lastMessageAt ?? conv.startedAt).getTime();
    const remaining = last + inactivityMs - Date.now();
    if (remaining > 0) {
      await this.timers.scheduleInactivityCheck(conversationId, remaining);
      return;
    }
    await this.lifecycle.closeConversation(conversationId, "system", "inactivity");
  }
}
