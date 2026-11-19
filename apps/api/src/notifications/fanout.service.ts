import {
  alerts,
  authUsers,
  helperAvailability,
  helperNotificationPrefs,
  helpers,
  notifications,
  type Database,
} from "@abrigo/db";
import { ALERT_PATH_LABELS } from "@abrigo/shared";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, eq, notExists, sql } from "@abrigo/db";
import type { Env } from "../config/env.js";
import { DB, ENV } from "../infra/tokens.js";
import { eligible } from "../proximity/eligibility.js";
import { MailerService } from "./mailer.service.js";
import { PushService } from "./push.service.js";
import { argentinaMinuteOfDay, isQuiet } from "./quiet-hours.js";
import { TelegramService } from "./telegram.service.js";

type Channel = "web_push" | "email" | "telegram";

/**
 * Aviso a ayudantes para un nivel de escalado. Cada ayudante recibe a lo sumo
 * un aviso por alerta y vuelta, aunque el escalado lo vuelva a incluir. El
 * contenido nunca lleva la zona ni datos de la persona.
 */
@Injectable()
export class FanoutService {
  private readonly logger = new Logger(FanoutService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
    @Inject(PushService) private readonly push: PushService,
    @Inject(MailerService) private readonly mailer: MailerService,
    @Inject(TelegramService) private readonly telegram: TelegramService,
  ) {}

  async fanout(alertId: string, level: number): Promise<number> {
    const [alert] = await this.db.select().from(alerts).where(eq(alerts.id, alertId)).limit(1);
    if (!alert || alert.status !== "open") return 0;

    const targets = await this.db
      .select({
        helperId: helpers.id,
        email: authUsers.email,
        prefs: {
          webPush: helperNotificationPrefs.webPush,
          email: helperNotificationPrefs.email,
          telegram: helperNotificationPrefs.telegram,
          quietStartMin: helperNotificationPrefs.quietStartMin,
          quietEndMin: helperNotificationPrefs.quietEndMin,
          telegramChatId: helperNotificationPrefs.telegramChatId,
        },
      })
      .from(helpers)
      .innerJoin(helperAvailability, eq(helperAvailability.helperId, helpers.id))
      .innerJoin(authUsers, eq(authUsers.id, helpers.userId))
      .innerJoin(alerts, eq(alerts.id, alertId))
      .leftJoin(helperNotificationPrefs, eq(helperNotificationPrefs.helperId, helpers.id))
      .where(
        and(
          eligible(level),
          notExists(
            this.db
              .select({ one: sql`1` })
              .from(notifications)
              .where(
                and(
                  eq(notifications.helperId, helpers.id),
                  eq(notifications.alertId, alertId),
                  eq(notifications.round, alert.round),
                ),
              ),
          ),
        ),
      );

    const label = ALERT_PATH_LABELS[alert.path];
    const text = `Hay una persona que necesita que la escuchen (${label}).`;
    const url = `${this.env.PUBLIC_APP_URL}/ayudante`;
    const minute = argentinaMinuteOfDay();
    let reached = 0;

    await Promise.all(
      targets.map(async (t) => {
        // Sin preferencias guardadas: push y email (Telegram requiere vincular).
        const p = t.prefs ?? {
          webPush: true,
          email: true,
          telegram: false,
          quietStartMin: null,
          quietEndMin: null,
          telegramChatId: null,
        };
        if (isQuiet(p.quietStartMin, p.quietEndMin, minute)) return;
        const sends: Promise<void>[] = [];
        if (p.webPush) {
          sends.push(
            this.deliver(t.helperId, alert, "web_push", () =>
              this.push.notifyHelper(t.helperId, { title: "Abrigo", body: text, url: "/ayudante" }),
            ),
          );
        }
        if (p.telegram && p.telegramChatId) {
          const chatId = p.telegramChatId;
          sends.push(
            this.deliver(t.helperId, alert, "telegram", () =>
              this.telegram.send(chatId, text, { text: "Abrir Abrigo", url }),
            ),
          );
        }
        if (p.email) {
          sends.push(
            this.deliver(t.helperId, alert, "email", () =>
              this.mailer.send(
                t.email,
                "Alguien necesita que lo escuchen",
                `${text}\n\nAbrir Abrigo: ${url}`,
              ),
            ),
          );
        }
        if (sends.length) reached++;
        await Promise.all(sends);
      }),
    );
    this.logger.log(`Nivel ${level}: aviso a ${reached} ayudantes`);
    return reached;
  }

  /** Registra el aviso una sola vez por ayudante, alerta, canal y vuelta. */
  private async deliver(
    helperId: string,
    alert: { id: string; round: number },
    channel: Channel,
    send: () => Promise<boolean>,
  ) {
    const [row] = await this.db
      .insert(notifications)
      .values({ helperId, alertId: alert.id, round: alert.round, channel })
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
