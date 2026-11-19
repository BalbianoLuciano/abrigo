import { alerts, authUsers, type Database } from "@abrigo/db";
import { ESCALATION } from "@abrigo/shared";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, eq, lt } from "@abrigo/db";
import type { Env } from "../config/env.js";
import { DB, ENV } from "../infra/tokens.js";
import { FanoutService } from "../notifications/fanout.service.js";
import { MailerService } from "../notifications/mailer.service.js";
import { RealtimeService } from "../realtime/realtime.service.js";

/** Sube el nivel de una alerta que nadie tomó todavía (SDD 03). */
@Injectable()
export class EscalationService {
  private readonly logger = new Logger(EscalationService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
    @Inject(FanoutService) private readonly fanout: FanoutService,
    @Inject(MailerService) private readonly mailer: MailerService,
    @Inject(RealtimeService) private readonly realtime: RealtimeService,
  ) {}

  /** Idempotente: solo sube si la alerta sigue abierta, en la misma vuelta y en un nivel menor. */
  async escalate(alertId: string, round: number, level: number): Promise<boolean> {
    const [alert] = await this.db
      .update(alerts)
      .set({ escalationLevel: level })
      .where(
        and(
          eq(alerts.id, alertId),
          eq(alerts.status, "open"),
          eq(alerts.round, round),
          lt(alerts.escalationLevel, level),
        ),
      )
      .returning();
    if (!alert) return false;

    if (level < ESCALATION.stillSearchingLevel) await this.fanout.fanout(alertId, level);
    this.realtime.alertListChanged();

    const widenedGender =
      level === ESCALATION.ignoreGenderFromLevel && alert.helperGenderPref === "woman";
    const stillSearching = level === ESCALATION.stillSearchingLevel;
    if (widenedGender || stillSearching) {
      this.realtime.alertUpdate(alert.anonSessionId, {
        alertId,
        status: "open",
        escalation: { level, ...(widenedGender ? { widenedGender } : {}), stillSearching },
      });
    }
    if (stillSearching) await this.notifyAdmins();
    this.logger.log(`Alerta escalada a nivel ${level}`);
    return true;
  }

  /** Sin datos de la alerta: solo que hay alguien esperando hace rato. */
  private async notifyAdmins() {
    const admins = await this.db
      .select({ email: authUsers.email })
      .from(authUsers)
      .where(eq(authUsers.role, "admin"));
    const minutes = Math.round(this.env.ESCALATION_DELAYS_MS[3]! / 60_000);
    await Promise.all(
      admins.map((a) =>
        this.mailer
          .send(
            a.email,
            "Un pedido sigue sin respuesta",
            `Hay un pedido abierto hace ${minutes} minutos sin que nadie lo tome.\n\n${this.env.PUBLIC_APP_URL}/admin`,
          )
          .catch(() => false),
      ),
    );
  }
}
