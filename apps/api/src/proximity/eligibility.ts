import { alertClaims, alerts, helperAvailability, helpers, sql, type SQL } from "@abrigo/db";
import { ESCALATION } from "@abrigo/shared";

/**
 * Única definición de "este ayudante puede recibir / ver esta alerta en este
 * nivel". La usan el aviso (fanout) y la lista de alertas abiertas, así lo que
 * ve cada ayudante coincide con a quién se avisó.
 *
 * Requiere que la consulta tenga `helpers`, `helper_availability` y `alerts`.
 * Los niveles son acumulativos (SDD 03):
 *   0: zona de cobertura que contiene el centro de la celda (o su provincia, si
 *      solo indicó provincia; o cualquiera que acepte remoto, si no indicó nada)
 *   1: + cobertura a menos de 50 km
 *   2: + misma provincia (o 200 km si solo hay celda)
 *   3: + todo el país (acepta remoto) y se ignora la preferencia de género
 */
export function eligible(level: SQL | number): SQL {
  const L = typeof level === "number" ? sql`${level}::int` : level;
  return sql`(
    ${helpers.status} = 'approved'
    AND ${helperAvailability.isOnCall}
    AND (${helperAvailability.pausedUntil} IS NULL OR ${helperAvailability.pausedUntil} < now())
    AND ${alerts.path} = ANY(${helpers.specialties})
    AND (
      ${alerts.helperGenderPref} IS DISTINCT FROM 'woman'
      OR ${helpers.gender} = 'woman'
      OR ${L} >= ${ESCALATION.ignoreGenderFromLevel}
    )
    AND NOT EXISTS (
      SELECT 1 FROM ${alertClaims}
      WHERE ${alertClaims.alertId} = ${alerts.id} AND ${alertClaims.helperId} = ${helpers.id}
    )
    AND (
      (${alerts.cellCenter} IS NULL AND ${alerts.regionCode} IS NULL AND ${helpers.acceptsRemoteAnywhere})
      OR (${alerts.cellCenter} IS NOT NULL AND ST_Intersects(${helpers.coverage}, ${alerts.cellCenter}))
      OR (${alerts.cellCenter} IS NULL AND ${alerts.regionCode} = ANY(${helpers.regionCodes}))
      OR (${L} >= 1 AND ST_DWithin(${helpers.coverage}, ${alerts.cellCenter}, ${ESCALATION.nearbyRadiusM}))
      OR (${L} >= 2 AND ${alerts.regionCode} = ANY(${helpers.regionCodes}))
      OR (${L} >= 2 AND ${alerts.regionCode} IS NULL
          AND ST_DWithin(${helpers.coverage}, ${alerts.cellCenter}, ${ESCALATION.provinceFallbackRadiusM}))
      OR (${L} >= 3 AND ${helpers.acceptsRemoteAnywhere})
    )
  )`;
}
