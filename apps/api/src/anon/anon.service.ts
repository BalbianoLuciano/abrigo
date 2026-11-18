import { createHash, randomBytes } from "node:crypto";
import {
  alerts,
  anonSessions,
  conversations,
  messages,
  pushSubscriptions,
  type Database,
} from "@abrigo/db";
import { Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray, isNull, or } from "@abrigo/db";
import type { Env } from "../config/env.js";
import { ENV, DB } from "../infra/tokens.js";
import { RealtimeService } from "../realtime/realtime.service.js";
import { AlertTimersService } from "../alerts/alert-timers.service.js";

/** Ventana en la que el token anterior sigue valiendo después de rotar. */
const ROTATION_GRACE_MS = 5 * 60_000;

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");

export interface ValidatedAnon {
  sessionId: string;
  /** Si se rotó, el token nuevo que el dispositivo tiene que guardar. */
  rotatedToken: string | null;
}

@Injectable()
export class AnonService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
    @Inject(RealtimeService) private readonly realtime: RealtimeService,
    @Inject(AlertTimersService) private readonly timers: AlertTimersService,
  ) {}

  async create(): Promise<{ sessionId: string; token: string }> {
    const token = newToken();
    const [row] = await this.db
      .insert(anonSessions)
      .values({ tokenHash: hashToken(token) })
      .returning({ id: anonSessions.id });
    return { sessionId: row!.id, token };
  }

  async validate(token: string): Promise<ValidatedAnon | null> {
    const digest = hashToken(token);
    const [session] = await this.db
      .select()
      .from(anonSessions)
      .where(
        and(
          isNull(anonSessions.deletedAt),
          or(eq(anonSessions.tokenHash, digest), eq(anonSessions.previousTokenHash, digest)),
        ),
      )
      .limit(1);
    if (!session) return null;

    const now = Date.now();
    if (now - session.lastSeenAt.getTime() > this.env.ANON_SESSION_MAX_IDLE_MS) return null;

    const usingPrevious = session.tokenHash !== digest;
    if (usingPrevious && now - session.tokenRotatedAt.getTime() > ROTATION_GRACE_MS) return null;

    if (
      !usingPrevious &&
      now - session.tokenRotatedAt.getTime() > this.env.ANON_TOKEN_ROTATION_MS
    ) {
      const fresh = newToken();
      await this.db
        .update(anonSessions)
        .set({
          tokenHash: hashToken(fresh),
          previousTokenHash: digest,
          tokenRotatedAt: new Date(),
          lastSeenAt: new Date(),
        })
        .where(eq(anonSessions.id, session.id));
      return { sessionId: session.id, rotatedToken: fresh };
    }

    await this.db
      .update(anonSessions)
      .set({ lastSeenAt: new Date() })
      .where(eq(anonSessions.id, session.id));
    return { sessionId: session.id, rotatedToken: null };
  }

  /**
   * "Borrar todo": cierra lo que esté en curso, borra los mensajes, desvincula
   * las alertas (quedan solo como métrica, sin zona) y elimina la sesión.
   */
  async eraseEverything(sessionId: string): Promise<void> {
    const affected = await this.db.transaction(async (tx) => {
      const convs = await tx
        .select({ id: conversations.id, endedAt: conversations.endedAt })
        .from(conversations)
        .where(eq(conversations.anonSessionId, sessionId));
      const convIds = convs.map((c) => c.id);
      const openConvIds = convs.filter((c) => !c.endedAt).map((c) => c.id);

      if (openConvIds.length) {
        await tx
          .update(conversations)
          .set({ endedAt: new Date(), endedBy: "anon", endReason: "erased" })
          .where(inArray(conversations.id, openConvIds));
      }
      if (convIds.length) {
        await tx.delete(messages).where(inArray(messages.conversationId, convIds));
      }
      const openAlerts = await tx
        .update(alerts)
        .set({ status: "closed", closedAt: new Date(), closeReason: "erased" })
        .where(
          and(
            eq(alerts.anonSessionId, sessionId),
            inArray(alerts.status, ["open", "claimed", "active"]),
          ),
        )
        .returning({ id: alerts.id });
      await tx
        .update(alerts)
        .set({ h3Cell: null, regionCode: null, anonymizedAt: new Date() })
        .where(eq(alerts.anonSessionId, sessionId));
      await tx.delete(pushSubscriptions).where(eq(pushSubscriptions.anonSessionId, sessionId));
      await tx.delete(anonSessions).where(eq(anonSessions.id, sessionId));
      return { openConvIds, openAlertIds: openAlerts.map((a) => a.id) };
    });

    for (const id of affected.openConvIds) {
      this.realtime.conversationClosed(id, "anon");
    }
    for (const id of affected.openAlertIds) {
      await this.timers.cancelForAlert(id);
      this.realtime.alertListChanged();
    }
    this.realtime.disconnectAnon(sessionId);
  }
}
