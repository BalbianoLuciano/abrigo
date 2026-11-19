import { ESCALATION } from "@abrigo/shared";
import {
  alertClaims,
  alerts,
  conversations,
  helperAvailability,
  helpers,
  type Database,
} from "@abrigo/db";
import type { AlertPath } from "@abrigo/shared";
import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, count, eq, inArray, isNull, sql } from "@abrigo/db";
import { AuditService } from "../audit/audit.service.js";
import { DB } from "../infra/tokens.js";
import { RealtimeService } from "../realtime/realtime.service.js";
import { AlertTimersService } from "./alert-timers.service.js";

export type EndedBy = "anon" | "helper" | "system";

/**
 * Transiciones del ciclo de vida de una alerta (01-arquitectura.md).
 * Lo usan la API y el worker. Cada transición es condicional sobre el estado
 * actual, así dos procesos no pueden pisarse.
 */
@Injectable()
export class LifecycleService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(AlertTimersService) private readonly timers: AlertTimersService,
    @Inject(RealtimeService) private readonly realtime: RealtimeService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  /** open → claimed. Solo un ayudante puede lograrlo. */
  async claim(alertId: string, helperId: string) {
    const helper = await this.loadClaimableHelper(helperId);

    const result = await this.db.transaction(async (tx) => {
      const [alert] = await tx.select().from(alerts).where(eq(alerts.id, alertId)).limit(1);
      if (!alert) throw new NotFoundException("Ese pedido ya no existe");
      if (!helper.specialties.includes(alert.path)) {
        throw new ConflictException({
          message: "Este pedido no es de tu especialidad",
          code: "specialty",
        });
      }
      if (
        alert.helperGenderPref === "woman" &&
        helper.gender !== "woman" &&
        alert.escalationLevel < ESCALATION.ignoreGenderFromLevel
      ) {
        throw new ConflictException({
          message: "La persona prefirió que le escriba una mujer",
          code: "gender_pref",
        });
      }
      const [previous] = await tx
        .select({ id: alertClaims.id })
        .from(alertClaims)
        .where(and(eq(alertClaims.alertId, alertId), eq(alertClaims.helperId, helperId)))
        .limit(1);
      if (previous) {
        throw new ConflictException({
          message: "Ya acompañaste este pedido y la persona pidió a otra persona",
          code: "already_claimed_before",
        });
      }

      const [active] = await tx
        .select({ n: count() })
        .from(conversations)
        .where(and(eq(conversations.helperId, helperId), isNull(conversations.endedAt)));
      if ((active?.n ?? 0) >= helper.maxConcurrent) {
        throw new ConflictException({
          message: `Ya tenés ${helper.maxConcurrent} conversaciones en curso`,
          code: "max_concurrent",
        });
      }

      const [claimed] = await tx
        .update(alerts)
        .set({ status: "claimed", claimedAt: new Date() })
        .where(and(eq(alerts.id, alertId), eq(alerts.status, "open")))
        .returning();
      if (!claimed) {
        throw new ConflictException({
          message: "Otra persona ya está acompañando este pedido",
          code: "already_claimed",
        });
      }
      const [claim] = await tx
        .insert(alertClaims)
        .values({
          alertId,
          helperId,
          escalationLevel: claimed.escalationLevel,
          waitMs: Math.max(0, Date.now() - claimed.roundStartedAt.getTime()),
        })
        .returning();
      const [conversation] = await tx
        .insert(conversations)
        .values({
          alertId,
          claimId: claim!.id,
          helperId,
          anonSessionId: claimed.anonSessionId,
        })
        .returning();
      await this.audit.record(
        {
          actorType: "helper",
          actorId: helperId,
          action: "alert.claimed",
          targetType: "alert",
          targetId: alertId,
        },
        tx,
      );
      return { alert: claimed, claim: claim!, conversation: conversation! };
    });

    await this.timers.scheduleClaimTimeout(alertId, result.claim.id);
    await this.timers.cancelEscalation(alertId, result.alert.round);
    this.realtime.alertUpdate(result.alert.anonSessionId, {
      alertId,
      status: "claimed",
      conversationId: result.conversation.id,
    });
    this.realtime.alertListChanged();
    return result;
  }

  /** claimed → active, con el primer mensaje del ayudante. Idempotente. */
  async markFirstHelperMessage(conversationId: string) {
    const [conv] = await this.db
      .select({ claimId: conversations.claimId, alertId: conversations.alertId })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);
    if (!conv) return;
    const [claim] = await this.db
      .update(alertClaims)
      .set({ firstMessageAt: new Date() })
      .where(and(eq(alertClaims.id, conv.claimId), isNull(alertClaims.firstMessageAt)))
      .returning({ id: alertClaims.id });
    if (!claim) return;
    const [alert] = await this.db
      .update(alerts)
      .set({ status: "active" })
      .where(and(eq(alerts.id, conv.alertId), eq(alerts.status, "claimed")))
      .returning();
    await this.timers.cancelClaimTimeout(claim.id);
    await this.timers.scheduleInactivityCheck(conversationId);
    if (alert) {
      this.realtime.alertUpdate(alert.anonSessionId, {
        alertId: alert.id,
        status: "active",
        conversationId,
      });
    }
  }

  /**
   * Libera la alerta tomada por un ayudante y la vuelve a abrir, con un nuevo
   * aviso. Se usa cuando no hubo primer mensaje a tiempo, cuando la persona pide
   * otra persona, o cuando se suspende al ayudante.
   */
  async releaseAndReopen(
    conversationId: string,
    reason: "no_first_message" | "reassigned" | "helper_suspended",
    endedBy: EndedBy,
  ): Promise<boolean> {
    const outcome = await this.db.transaction(async (tx) => {
      const [conv] = await tx
        .update(conversations)
        .set({ endedAt: new Date(), endedBy, endReason: reason })
        .where(and(eq(conversations.id, conversationId), isNull(conversations.endedAt)))
        .returning();
      if (!conv) return null;
      await tx
        .update(alertClaims)
        .set({ releasedAt: new Date(), releaseReason: reason })
        .where(eq(alertClaims.id, conv.claimId));
      const [alert] = await tx
        .update(alerts)
        .set({
          status: "open",
          claimedAt: null,
          escalationLevel: sql`CASE WHEN ${alerts.dangerNow} = 'no' THEN 0 ELSE 1 END`,
          roundStartedAt: new Date(),
          round: sql`${alerts.round} + 1`,
        })
        .where(and(eq(alerts.id, conv.alertId), inArray(alerts.status, ["claimed", "active"])))
        .returning();
      await this.audit.record(
        {
          actorType: endedBy === "system" ? "system" : endedBy,
          actorId: endedBy === "helper" ? conv.helperId : null,
          action: "alert.released",
          targetType: "alert",
          targetId: conv.alertId,
          metadata: { reason },
        },
        tx,
      );
      return { conv, alert: alert ?? null };
    });
    if (!outcome) return false;

    const { conv, alert } = outcome;
    await this.timers.cancelClaimTimeout(conv.claimId);
    this.realtime.conversationClosed(conv.id, endedBy, reason);
    this.realtime.removeHelperFromConversation(conv.helperId, conv.id);
    if (alert) {
      this.realtime.alertUpdate(alert.anonSessionId, {
        alertId: alert.id,
        status: "open",
        reason,
      });
      await this.timers.startRound(alert);
      this.realtime.alertListChanged();
    }
    return true;
  }

  /** Cierra la conversación y la alerta (cualquiera de las dos partes, o el sistema). */
  async closeConversation(conversationId: string, endedBy: EndedBy, reason: string) {
    const outcome = await this.db.transaction(async (tx) => {
      const [conv] = await tx
        .update(conversations)
        .set({ endedAt: new Date(), endedBy, endReason: reason })
        .where(and(eq(conversations.id, conversationId), isNull(conversations.endedAt)))
        .returning();
      if (!conv) return null;
      const [alert] = await tx
        .update(alerts)
        .set({ status: "closed", closedAt: new Date(), closeReason: `${endedBy}:${reason}` })
        .where(and(eq(alerts.id, conv.alertId), inArray(alerts.status, ["claimed", "active"])))
        .returning();
      await this.audit.record(
        {
          actorType: endedBy === "system" ? "system" : endedBy,
          actorId: endedBy === "helper" ? conv.helperId : null,
          action: "conversation.closed",
          targetType: "conversation",
          targetId: conv.id,
          metadata: { reason },
        },
        tx,
      );
      return { conv, alert: alert ?? null };
    });
    if (!outcome) return false;
    await this.timers.cancelClaimTimeout(outcome.conv.claimId);
    this.realtime.conversationClosed(conversationId, endedBy, reason);
    if (outcome.alert) {
      this.realtime.alertUpdate(outcome.alert.anonSessionId, {
        alertId: outcome.alert.id,
        status: "closed",
        reason,
      });
    }
    return true;
  }

  /** open → closed (la persona cancela o nadie respondió a tiempo). */
  async closeOpenAlert(alertId: string, reason: "cancelled" | "no_response") {
    const [alert] = await this.db
      .update(alerts)
      .set({ status: "closed", closedAt: new Date(), closeReason: reason })
      .where(and(eq(alerts.id, alertId), eq(alerts.status, "open")))
      .returning();
    if (!alert) return null;
    await this.audit.record({
      actorType: reason === "cancelled" ? "anon" : "system",
      action: "alert.closed",
      targetType: "alert",
      targetId: alertId,
      metadata: { reason },
    });
    await this.timers.cancelForAlert(alertId);
    this.realtime.alertUpdate(alert.anonSessionId, { alertId, status: "closed", reason });
    this.realtime.alertListChanged();
    return alert;
  }

  private async loadClaimableHelper(helperId: string) {
    const [row] = await this.db
      .select({
        id: helpers.id,
        status: helpers.status,
        gender: helpers.gender,
        specialties: helpers.specialties,
        maxConcurrent: helpers.maxConcurrent,
        isOnCall: helperAvailability.isOnCall,
      })
      .from(helpers)
      .leftJoin(helperAvailability, eq(helperAvailability.helperId, helpers.id))
      .where(eq(helpers.id, helperId))
      .limit(1);
    if (!row || row.status !== "approved") {
      throw new ConflictException({
        message: "Tu cuenta no está habilitada",
        code: "not_approved",
      });
    }
    return row as typeof row & { specialties: AlertPath[] };
  }
}
