import {
  alertClaims,
  alerts,
  authUsers,
  helperAvailability,
  helpers,
  notifications,
  type Database,
} from "@abrigo/db";
import { ALERT_PATH_LABELS } from "@abrigo/shared";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, arrayContains, eq, gt, isNull, notExists, or, sql } from "@abrigo/db";
import type { Env } from "../config/env.js";
import { DB, ENV } from "../infra/tokens.js";
import { MailerService } from "./mailer.service.js";
import { PushService } from "./push.service.js";

/**
 * Aviso a ayudantes (etapa 1): todos los de guardia de la especialidad, sin
 * filtrar por cercanía. El contenido nunca lleva datos sensibles ni la zona.
 */
@Injectable()
export class FanoutService {
  private readonly logger = new Logger(FanoutService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
    @Inject(PushService) private readonly push: PushService,
    @Inject(MailerService) private readonly mailer: MailerService,
  ) {}

  async fanout(alertId: string): Promise<number> {
    const [alert] = await this.db.select().from(alerts).where(eq(alerts.id, alertId)).limit(1);
    if (!alert || alert.status !== "open") return 0;

    const targets = await this.db
      .select({ helperId: helpers.id, email: authUsers.email })
      .from(helpers)
      .innerJoin(helperAvailability, eq(helperAvailability.helperId, helpers.id))
      .innerJoin(authUsers, eq(authUsers.id, helpers.userId))
      .where(
        and(
          eq(helpers.status, "approved"),
          eq(helperAvailability.isOnCall, true),
          or(
            isNull(helperAvailability.pausedUntil),
            gt(sql`now()`, helperAvailability.pausedUntil),
          ),
          arrayContains(helpers.specialties, [alert.path]),
          alert.helperGenderPref === "woman" ? eq(helpers.gender, "woman") : undefined,
          notExists(
            this.db
              .select({ one: sql`1` })
              .from(alertClaims)
              .where(and(eq(alertClaims.alertId, alertId), eq(alertClaims.helperId, helpers.id))),
          ),
        ),
      );

    const label = ALERT_PATH_LABELS[alert.path];
    const text = `Hay una persona que necesita que la escuchen (${label}).`;
    const url = `${this.env.PUBLIC_APP_URL}/ayudante/alertas`;

    await Promise.all(
      targets.map(async (t) => {
        await this.deliver(t.helperId, alert.id, alert.round, "web_push", () =>
          this.push.notifyHelper(t.helperId, {
            title: "Abrigo",
            body: text,
            url: "/ayudante/alertas",
          }),
        );
        await this.deliver(t.helperId, alert.id, alert.round, "email", () =>
          this.mailer.send(
            t.email,
            "Alguien necesita que lo escuchen",
            `${text}\n\nAbrir Abrigo: ${url}`,
          ),
        );
      }),
    );
    this.logger.log(`Aviso de alerta enviado a ${targets.length} ayudantes`);
    return targets.length;
  }

  /** Registra el aviso una sola vez por ayudante, alerta, canal y vuelta. */
  private async deliver(
    helperId: string,
    alertId: string,
    round: number,
    channel: "web_push" | "email",
    send: () => Promise<boolean>,
  ) {
    const [row] = await this.db
      .insert(notifications)
      .values({ helperId, alertId, round, channel })
      .onConflictDoNothing()
      .returning({ id: notifications.id });
    if (!row) return;
    try {
      const ok = await send();
      await this.db
        .update(notifications)
        .set(
          ok ? { status: "sent", sentAt: new Date() } : { status: "failed", error: "sin destino" },
        )
        .where(eq(notifications.id, row.id));
    } catch (err) {
      await this.db
        .update(notifications)
        .set({ status: "failed", error: (err as Error).name })
        .where(eq(notifications.id, row.id));
    }
  }
}
