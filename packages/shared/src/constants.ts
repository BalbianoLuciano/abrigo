/** Constantes sin dependencias: se pueden importar desde la ruta de pedido de ayuda sin cargar zod. */

/** Los dos caminos de ayuda. Ver docs/sdd/00-vision-y-alcance.md. */
export const ALERT_PATHS = ["mental_health", "violence"] as const;
export type AlertPath = (typeof ALERT_PATHS)[number];

export const DANGER_LEVELS = ["yes", "unsure", "no"] as const;
export type DangerNow = (typeof DANGER_LEVELS)[number];

export const SAFE_TIME_OPTIONS = ["yes", "little", "no"] as const;
export type SafeTimeToWrite = (typeof SAFE_TIME_OPTIONS)[number];

export const HELPER_GENDER_PREFS = ["woman", "any"] as const;
export type HelperGenderPref = (typeof HELPER_GENDER_PREFS)[number];

/** Ciclo de vida de una alerta. Ver docs/sdd/01-arquitectura.md. */
export const ALERT_STATUSES = ["open", "claimed", "active", "closed"] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

/** Hay que mostrar las líneas oficiales antes de enviar la alerta. */
export function requiresCrisisLines(dangerNow: DangerNow): boolean {
  return dangerNow !== "no";
}

/** Nombre de cada camino tal como se muestra (y en los avisos a ayudantes). */
export const ALERT_PATH_LABELS: Record<AlertPath, string> = {
  mental_health: "salud mental",
  violence: "violencia",
};

export const PROFESSIONS = [
  "psicologia",
  "psiquiatria",
  "trabajo_social",
  "acompanamiento_terapeutico",
  "voluntariado",
] as const;
export type Profession = (typeof PROFESSIONS)[number];

export const PROFESSION_LABELS: Record<Profession, string> = {
  psicologia: "psicóloga/o",
  psiquiatria: "psiquiatra",
  trabajo_social: "trabajadora/or social",
  acompanamiento_terapeutico: "acompañante terapéutica/o",
  voluntariado: "voluntaria/o",
};

/** Profesiones que requieren matrícula (el voluntariado requiere organización). */
export const LICENSED_PROFESSIONS: readonly Profession[] = [
  "psicologia",
  "psiquiatria",
  "trabajo_social",
  "acompanamiento_terapeutico",
];

export const HELPER_GENDERS = ["woman", "man", "non_binary", "prefer_not"] as const;

export const REPORT_REASONS = [
  "disrespect",
  "inappropriate",
  "asked_personal_data",
  "spam",
  "other",
] as const;

/**
 * Escalado progresivo (SDD 03). Cada nivel suma destinatarios a los anteriores.
 * Las demoras corren desde el inicio de la vuelta (creación o reapertura).
 */
export const ESCALATION = {
  /** Nivel 1: radio alrededor del centro de la celda. */
  nearbyRadiusM: 50_000,
  /** Nivel 2 sin provincia conocida (solo celda): radio que aproxima "la provincia". */
  provinceFallbackRadiusM: 200_000,
  /** Nivel desde el que se ignora la preferencia de género. */
  ignoreGenderFromLevel: 3,
  /** Nivel en el que se avisa a la persona y al equipo. */
  stillSearchingLevel: 4,
  maxLevel: 4,
} as const;

/** Nivel inicial: quien indicó peligro arranca en 1. */
export function initialEscalationLevel(dangerNow: DangerNow): number {
  return dangerNow === "no" ? 0 : 1;
}
