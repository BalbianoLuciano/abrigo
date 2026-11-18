import { z } from "zod";
import {
  ALERT_PATHS,
  ALERT_STATUSES,
  DANGER_LEVELS,
  HELPER_GENDER_PREFS,
  SAFE_TIME_OPTIONS,
  requiresCrisisLines,
} from "./constants.js";

export const alertPathSchema = z.enum(ALERT_PATHS);
export const dangerNowSchema = z.enum(DANGER_LEVELS);
export const alertStatusSchema = z.enum(ALERT_STATUSES);

/** Índice H3 (resolución 6) calculado en el dispositivo. Nunca coordenadas. */
const h3CellSchema = z.string().regex(/^[0-9a-f]{15}$/, "Celda H3 inválida");

const baseAlert = z.object({
  ageConfirmed: z.literal(true),
  dangerNow: dangerNowSchema,
  h3Cell: h3CellSchema.optional(),
  regionCode: z.string().min(2).max(10).optional(),
  consentAccepted: z.literal(true),
  /** Cuándo se le mostraron las líneas de crisis en el dispositivo (obligatorio con peligro). */
  crisisLinesShownAt: z.iso.datetime().optional(),
});

const alertVariants = z.discriminatedUnion("path", [
  baseAlert.extend({ path: z.literal("mental_health") }),
  baseAlert.extend({
    path: z.literal("violence"),
    safeTimeToWrite: z.enum(SAFE_TIME_OPTIONS).optional(),
    helperGenderPref: z.enum(HELPER_GENDER_PREFS).optional(),
  }),
]);

/** Primero la vida: con peligro o duda, las líneas tienen que haberse mostrado antes de enviar. */
export const createAlertSchema = alertVariants.refine(
  (a) => !requiresCrisisLines(a.dangerNow) || a.crisisLinesShownAt !== undefined,
  { message: "Faltan mostrar las líneas de crisis", path: ["crisisLinesShownAt"] },
);
export type CreateAlertInput = z.infer<typeof createAlertSchema>;
