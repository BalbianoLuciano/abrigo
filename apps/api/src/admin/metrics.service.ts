import { alertClaims, alerts, type Database } from "@abrigo/db";
import { Inject, Injectable } from "@nestjs/common";
import { and, count, eq, gt, isNull, sql } from "@abrigo/db";
import { DB } from "../infra/tokens.js";

/**
 * Métricas agregadas (SDD 03, tarea 6): tiempo hasta que alguien toma un
 * pedido, por nivel de escalado y por provincia. Nunca devuelve filas sueltas.
 */
@Injectable()
export class MetricsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async summary(days: number) {
    const since = new Date(Date.now() - days * 24 * 3600_000);
    const waitStats = {
      claims: count(),
      p50Seconds: sql<number>`round((percentile_cont(0.5) WITHIN GROUP (ORDER BY ${alertClaims.waitMs}) / 1000)::numeric)::int`,
      p90Seconds: sql<number>`round((percentile_cont(0.9) WITHIN GROUP (ORDER BY ${alertClaims.waitMs}) / 1000)::numeric)::int`,
    };
    const inWindow = gt(alertClaims.claimedAt, since);

    const byLevel = await this.db
      .select({ level: alertClaims.escalationLevel, ...waitStats })
      .from(alertClaims)
      .where(inWindow)
      .groupBy(alertClaims.escalationLevel)
      .orderBy(alertClaims.escalationLevel);

    const region = sql<string>`coalesce(${alerts.regionCode}, CASE WHEN ${alerts.h3Cell} IS NULL THEN 'none' ELSE 'cell' END)`;
    const byRegion = await this.db
      .select({ region, ...waitStats })
      .from(alertClaims)
      .innerJoin(alerts, eq(alerts.id, alertClaims.alertId))
      .where(inWindow)
      .groupBy(region)
      .orderBy(region);

    const [unanswered] = await this.db
      .select({ n: count() })
      .from(alerts)
      .where(
        and(
          gt(alerts.createdAt, since),
          eq(alerts.closeReason, "no_response"),
          isNull(alerts.claimedAt),
        ),
      );
    const [created] = await this.db
      .select({ n: count() })
      .from(alerts)
      .where(gt(alerts.createdAt, since));

    return {
      days,
      alertsCreated: created?.n ?? 0,
      alertsUnanswered: unanswered?.n ?? 0,
      byLevel,
      byRegion,
    };
  }
}
