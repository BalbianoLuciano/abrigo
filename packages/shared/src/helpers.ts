import { z } from "zod";
import {
  ALERT_PATHS,
  HELPER_GENDERS,
  LICENSED_PROFESSIONS,
  PROFESSIONS,
  REPORT_REASONS,
} from "./constants.js";

const coverageSchema = z.object({
  lat: z.number().min(-56).max(-21),
  lng: z.number().min(-74).max(-53),
  radiusKm: z.number().min(2).max(500),
});

export const helperRegistrationSchema = z
  .object({
    email: z.email().max(254),
    password: z.string().min(12).max(128),
    firstName: z.string().trim().min(1).max(60),
    lastName: z.string().trim().min(1).max(60),
    profession: z.enum(PROFESSIONS),
    licenseNumber: z.string().trim().max(40).optional(),
    licenseJurisdiction: z.string().trim().max(60).optional(),
    organization: z.string().trim().max(120).optional(),
    specialties: z.array(z.enum(ALERT_PATHS)).min(1),
    gender: z.enum(HELPER_GENDERS).optional(),
    languages: z.array(z.string().min(2).max(5)).min(1).default(["es"]),
    bioShort: z.string().trim().max(280).optional(),
    coverage: coverageSchema.optional(),
    acceptsRemoteAnywhere: z.boolean().default(true),
    acceptsCodeOfConduct: z.literal(true),
    captchaToken: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (LICENSED_PROFESSIONS.includes(v.profession)) {
      if (!v.licenseNumber) {
        ctx.addIssue({ code: "custom", path: ["licenseNumber"], message: "Ingresá tu matrícula" });
      }
      if (!v.licenseJurisdiction) {
        ctx.addIssue({
          code: "custom",
          path: ["licenseJurisdiction"],
          message: "Indicá la jurisdicción de la matrícula",
        });
      }
    } else if (!v.organization) {
      ctx.addIssue({
        code: "custom",
        path: ["organization"],
        message: "Indicá la organización con la que colaborás",
      });
    }
  });
export type HelperRegistrationInput = z.infer<typeof helperRegistrationSchema>;

export const availabilitySchema = z.object({
  isOnCall: z.boolean(),
  pausedUntil: z.iso.datetime().nullable().optional(),
});

export const helperDecisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  reason: z.string().trim().max(500).optional(),
});

export const suspendSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export const reportSchema = z.object({
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(1000).optional(),
});

export const closeConversationSchema = z.object({
  helperNote: z.string().trim().max(2000).optional(),
});

export const pushSubscriptionSchema = z.object({
  endpoint: z.url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});
