import { alerts, conversations, helperAvailability, helpers, type Database } from "@abrigo/db";
import { initialEscalationLevel, type CreateAlertInput } from "@abrigo/shared";
import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, desc, eq, inArray, isNull, sql } from "@abrigo/db";
import { eligible } from "../proximity/eligibility.js";
import { AbuseService } from "../common/abuse.service.js";
import { AuditService } from "../audit/audit.service.js";
import type { Env } from "../config/env.js";
import { DB, ENV } from "../infra/tokens.js";
import { RealtimeService } from "../realtime/realtime.service.js";
import { AlertTimersService } from "./alert-timers.service.js";
import { LifecycleService } from "./lifecycle.service.js";
import { assertCoarseCell, cellCenterSql } from "../proximity/h3.js";

const LIVE_STATUSES = ["open", "claimed", "active"] as const;

@Injectable()
export class AlertsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
    @Inject(AbuseService) private readonly abuse: AbuseService,
    @Inject(AlertTimersService) private readonly timers: AlertTimersService,
    @Inject(LifecycleService) private readonly lifecycle: LifecycleService,
    @Inject(RealtimeService) private readonly realtime: RealtimeService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async create(sessionId: string, input: CreateAlertInput, ip: string, captcha?: string) {
    await this.abuse.verifyCaptcha(captcha, ip);
    if (input.h3Cell) assertCoarseCell(input.h3Cell);

    const [live] = await this.db
      .select({ id: alerts.id })
      .from(alerts)
      .where(and(eq(alerts.anonSessionId, sessionId), inArray(alerts.status, [...LIVE_STATUSES])))
      .limit(1);
    if (live) {
      throw new ConflictException({
        message: "Ya tenés un pedido en curso",
        code: "alert_in_progress",
        alertId: live.id,
      });
    }

    await this.abuse.consume(
      `session:${sessionId}`,
      this.env.MAX_ALERTS_PER_SESSION_24H,
      "Llegaste al máximo de pedidos por hoy. Las líneas de ayuda atienden ahora.",
    );
    await this.abuse.consume(
      `ip:${await this.abuse.hashIp(ip)}`,
      this.env.MAX_ALERTS_PER_IP_24H,
      "Llegaste al máximo de pedidos por hoy. Las líneas de ayuda atienden ahora.",
    );

    const [alert] = await this.db
      .insert(alerts)
      .values({
        anonSessionId: sessionId,
        path: input.path,
        dangerNow: input.dangerNow,
        safeTimeToWrite: input.path === "violence" ? (input.safeTimeToWrite ?? null) : null,
        helperGenderPref: input.path === "violence" ? (input.helperGenderPref ?? null) : null,
        h3Cell: input.h3Cell ?? null,
        cellCenter: input.h3Cell ? cellCenterSql(input.h3Cell) : null,
        escalationLevel: initialEscalationLevel(input.dangerNow),
        regionCode: input.regionCode ?? null,
        crisisLinesShownAt: input.crisisLinesShownAt ? new Date(input.crisisLinesShownAt) : null,
      })
      .returning();
    await this.audit.record({
      actorType: "anon",
      action: "alert.created",
      targetType: "alert",
      targetId: alert!.id,
      metadata: { path: input.path, dangerNow: input.dangerNow },
    });
    await this.timers.startRound(alert!);
    this.realtime.alertListChanged();
    return this.toPublic(alert!, null);
  }

  /** Estado del pedido actual de la persona (para reanudar después de recargar). */
  async current(sessionId: string) {
    const [alert] = await this.db
      .select()
      .from(alerts)
      .where(eq(alerts.anonSessionId, sessionId))
      .orderBy(desc(alerts.createdAt))
      .limit(1);
    if (!alert) return null;
    const [conv] = await this.db
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(eq(conversations.alertId, alert.id), isNull(conversations.endedAt)))
      .limit(1);
    return this.toPublic(alert, conv?.id ?? null);
  }

  async cancel(sessionId: string, alertId: string) {
    const alert = await this.ownAlert(sessionId, alertId);
    if (alert.status === "open") {
      await this.lifecycle.closeOpenAlert(alertId, "cancelled");
      return;
    }
    if (alert.status === "claimed" || alert.status === "active") {
      const conv = await this.liveConversation(alertId);
      if (conv) await this.lifecycle.closeConversation(conv.id, "anon", "cancelled");
    }
  }

  /** "Pedir otra persona": libera al ayudante actual y vuelve a avisar. */
  async reassign(sessionId: string, alertId: string) {
    const alert = await this.ownAlert(sessionId, alertId);
    const conv = await this.liveConversation(alertId);
    if (!conv || (alert.status !== "claimed" && alert.status !== "active")) {
      throw new ConflictException({
        message: "Todavía no hay nadie acompañándote",
        code: "not_claimed",
      });
    }
    await this.lifecycle.releaseAndReopen(conv.id, "reassigned", "anon");
  }

  /**
   * Alertas abiertas que este ayudante puede ver ahora: las mismas reglas de
   * cercanía que el aviso, según el nivel de escalado actual de cada una. Nunca
   * se expone nada más preciso que la celda H3.
   */
  async listOpenFor(helperId: string) {
    return (
      this.db
        .select({
          id: alerts.id,
          path: alerts.path,
          dangerNow: alerts.dangerNow,
          safeTimeToWrite: alerts.safeTimeToWrite,
          helperGenderPref: alerts.helperGenderPref,
          regionCode: alerts.regionCode,
          h3Cell: alerts.h3Cell,
          language: alerts.language,
          escalationLevel: alerts.escalationLevel,
          createdAt: alerts.createdAt,
        })
        .from(alerts)
        .innerJoin(helpers, eq(helpers.id, helperId))
        .innerJoin(helperAvailability, eq(helperAvailability.helperId, helpers.id))
        .where(and(eq(alerts.status, "open"), eligible(sql`${alerts.escalationLevel}`)))
        // Primero quienes indicaron peligro, después las más antiguas.
        .orderBy(
          sql`CASE ${alerts.dangerNow} WHEN 'yes' THEN 0 WHEN 'unsure' THEN 1 ELSE 2 END`,
          asc(alerts.createdAt),
        )
    );
  }

  private async ownAlert(sessionId: string, alertId: string) {
    const [alert] = await this.db
      .select()
      .from(alerts)
      .where(and(eq(alerts.id, alertId), eq(alerts.anonSessionId, sessionId)))
      .limit(1);
    if (!alert) throw new NotFoundException("No encontramos ese pedido");
    return alert;
  }

  private async liveConversation(alertId: string) {
    const [conv] = await this.db
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(eq(conversations.alertId, alertId), isNull(conversations.endedAt)))
      .limit(1);
    return conv ?? null;
  }

  private toPublic(alert: typeof alerts.$inferSelect, conversationId: string | null) {
    return {
      id: alert.id,
      path: alert.path,
      status: alert.status,
      dangerNow: alert.dangerNow,
      // Para explicarle a la persona en qué etapa de la búsqueda estamos (SDD 03).
      escalationLevel: alert.escalationLevel,
      helperGenderPref: alert.helperGenderPref,
      createdAt: alert.createdAt.toISOString(),
      closeReason: alert.closeReason,
      conversationId,
    };
  }
}
