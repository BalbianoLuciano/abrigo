import { z } from "zod";

const ms = (def: number) => z.coerce.number().int().positive().default(def);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  /** CA de Memorystore (rediss:// con autenticación del servidor). */
  REDIS_CA_CERT: z.string().optional(),
  /** Origen de la PWA (CORS, cookies y links en emails). */
  PUBLIC_APP_URL: z.string().url().default("http://localhost:8081"),
  /** URL pública de esta API (Better Auth). */
  API_URL: z.string().url().default("http://localhost:3000"),
  BETTER_AUTH_SECRET: z.string().min(32),

  /** Cifrado de mensajes: "local" (claves en env, solo dev/test) o "gcp-kms". */
  MESSAGE_KEY_PROVIDER: z.enum(["local", "gcp-kms"]).default("local"),
  /** "versión:clave_base64[,versión:clave_base64]". Local: claves en claro. KMS: claves envueltas. */
  MESSAGE_KEYS: z.string().min(1),
  MESSAGE_KEY_CURRENT_VERSION: z.coerce.number().int().positive().default(1),
  KMS_KEY_NAME: z.string().optional(),

  TURNSTILE_SECRET_KEY: z.string().optional(),

  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default("mailto:hola@abrigo.ar"),

  SMTP_URL: z.string().optional(),
  EMAIL_FROM: z.string().default("Abrigo <avisos@abrigo.ar>"),

  /** Tiempos del ciclo de vida de una alerta (ver 01-arquitectura.md). */
  CLAIM_TIMEOUT_MS: ms(3 * 60_000),
  ALERT_EXPIRY_MS: ms(2 * 60 * 60_000),
  CONVERSATION_INACTIVITY_MS: ms(24 * 60 * 60_000),
  ANON_TOKEN_ROTATION_MS: ms(24 * 60 * 60_000),
  ANON_SESSION_MAX_IDLE_MS: ms(30 * 24 * 60 * 60_000),
  /** Demoras de los niveles 1..4 de escalado, desde el inicio de la vuelta (SDD 03). */
  ESCALATION_DELAYS_MS: z
    .string()
    .default("180000,360000,600000,1200000")
    .transform((v) => v.split(",").map((n) => Number(n.trim())))
    .pipe(z.array(z.number().int().positive()).length(4)),

  /** Bot de Telegram (opcional). */
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_BOT_USERNAME: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(16).optional(),
  TELEGRAM_API_BASE: z.string().url().default("https://api.telegram.org"),

  MAX_ALERTS_PER_SESSION_24H: z.coerce.number().int().positive().default(3),
  MAX_ALERTS_PER_IP_24H: z.coerce.number().int().positive().default(10),
  MAX_REGISTRATIONS_PER_IP_24H: z.coerce.number().int().positive().default(5),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new Error(`Configuración inválida:\n${issues.join("\n")}`);
  }
  if (parsed.data.NODE_ENV === "production") {
    if (parsed.data.MESSAGE_KEY_PROVIDER !== "gcp-kms") {
      throw new Error("En producción los mensajes se cifran con claves de Cloud KMS");
    }
    if (!parsed.data.TURNSTILE_SECRET_KEY) {
      throw new Error("En producción TURNSTILE_SECRET_KEY es obligatorio");
    }
  }
  return parsed.data;
}
