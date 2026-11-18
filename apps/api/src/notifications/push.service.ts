import { pushSubscriptions, type Database } from "@abrigo/db";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { eq, inArray } from "@abrigo/db";
import * as webpush from "web-push";
import type { Env } from "../config/env.js";
import { DB, ENV } from "../infra/tokens.js";

export interface PushPayload {
  title: string;
  body: string;
  url: string;
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly enabled: boolean;

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) env: Env,
  ) {
    this.enabled = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
    if (this.enabled) {
      webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
    }
  }

  async subscribe(
    owner: { kind: "anon"; sessionId: string } | { kind: "helper"; helperId: string },
    sub: PushSubscriptionInput,
  ) {
    const values = {
      ownerType: owner.kind,
      anonSessionId: owner.kind === "anon" ? owner.sessionId : null,
      helperId: owner.kind === "helper" ? owner.helperId : null,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    };
    await this.db
      .insert(pushSubscriptions)
      .values(values)
      .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: values });
  }

  async notifyAnon(sessionId: string, payload: PushPayload) {
    const subs = await this.db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.anonSessionId, sessionId));
    await this.sendAll(subs, payload);
  }

  /** Devuelve true si se entregó a al menos una suscripción. */
  async notifyHelper(helperId: string, payload: PushPayload): Promise<boolean> {
    const subs = await this.db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.helperId, helperId));
    return (await this.sendAll(subs, payload)) > 0;
  }

  private async sendAll(subs: (typeof pushSubscriptions.$inferSelect)[], payload: PushPayload) {
    if (!this.enabled || !subs.length) return 0;
    const gone: string[] = [];
    let delivered = 0;
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify(payload),
            { TTL: 600, urgency: "high" },
          );
          delivered++;
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) gone.push(s.id);
          else this.logger.warn(`Web Push falló (status ${status ?? "?"})`);
        }
      }),
    );
    if (gone.length)
      await this.db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, gone));
    return delivered;
  }
}
