import {
  ALERT_PATHS,
  ALERT_STATUSES,
  DANGER_LEVELS,
  HELPER_GENDER_PREFS,
  SAFE_TIME_OPTIONS,
} from "@abrigo/shared";
import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authUsers } from "./auth.js";

/** geography(Polygon, 4326). Se escribe con funciones PostGIS (ver queries). */
const geographyPolygon = customType<{ data: string; driverData: string }>({
  dataType: () => "geography(Polygon, 4326)",
});

/** geography(Point, 4326): centro de la celda H3. Nunca sale de la API. */
const geographyPoint = customType<{ data: string; driverData: string }>({
  dataType: () => "geography(Point, 4326)",
});

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

const ts = (name: string) => timestamp(name, { withTimezone: true });

export const alertPathEnum = pgEnum("alert_path", ALERT_PATHS);
export const alertStatusEnum = pgEnum("alert_status", ALERT_STATUSES);
export const dangerNowEnum = pgEnum("danger_now", DANGER_LEVELS);
export const safeTimeEnum = pgEnum("safe_time_to_write", SAFE_TIME_OPTIONS);
export const helperGenderPrefEnum = pgEnum("helper_gender_pref", HELPER_GENDER_PREFS);
export const helperStatusEnum = pgEnum("helper_status", [
  "pending",
  "approved",
  "rejected",
  "suspended",
]);
export const messageSenderEnum = pgEnum("message_sender", ["anon", "helper", "system"]);
export const partyEnum = pgEnum("party", ["anon", "helper"]);
export const notificationChannelEnum = pgEnum("notification_channel", [
  "web_push",
  "email",
  "telegram",
  "expo_push",
]);
export const notificationStatusEnum = pgEnum("notification_status", ["queued", "sent", "failed"]);

/** Sesión anónima de la persona que pide ayuda. Sin nombre, email ni teléfono. */
export const anonSessions = pgTable(
  "anon_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** SHA-256 del token vigente. El token en claro solo vive en el dispositivo. */
    tokenHash: text("token_hash").notNull(),
    /** Token anterior, aceptado durante la ventana de rotación. */
    previousTokenHash: text("previous_token_hash"),
    tokenRotatedAt: ts("token_rotated_at").notNull().defaultNow(),
    createdAt: ts("created_at").notNull().defaultNow(),
    lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
    deletedAt: ts("deleted_at"),
  },
  (t) => [
    uniqueIndex("anon_sessions_token_idx").on(t.tokenHash),
    index("anon_sessions_prev_token_idx").on(t.previousTokenHash),
  ],
);

export const helpers = pgTable(
  "helpers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    gender: text("gender"),
    profession: text("profession").notNull(),
    licenseNumber: text("license_number"),
    licenseJurisdiction: text("license_jurisdiction"),
    organization: text("organization"),
    specialties: alertPathEnum("specialties").array().notNull(),
    languages: text("languages")
      .array()
      .notNull()
      .default(sql`ARRAY['es']::text[]`),
    bioShort: text("bio_short"),
    coverage: geographyPolygon("coverage"),
    /** Provincias cuyos recursos conoce (ISO 3166-2:AR). */
    regionCodes: text("region_codes")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    acceptsRemoteAnywhere: boolean("accepts_remote_anywhere").notNull().default(true),
    maxConcurrent: smallint("max_concurrent").notNull().default(2),
    status: helperStatusEnum("status").notNull().default("pending"),
    codeOfConductAcceptedAt: ts("code_of_conduct_accepted_at").notNull(),
    verifiedBy: text("verified_by").references(() => authUsers.id),
    verifiedAt: ts("verified_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("helpers_status_idx").on(t.status),
    index("helpers_coverage_gist").using("gist", t.coverage),
    index("helpers_region_codes_gin").using("gin", t.regionCodes),
  ],
);

/** Canales y horario de silencio de cada ayudante. */
export const helperNotificationPrefs = pgTable("helper_notification_prefs", {
  helperId: uuid("helper_id")
    .primaryKey()
    .references(() => helpers.id, { onDelete: "cascade" }),
  webPush: boolean("web_push").notNull().default(true),
  email: boolean("email").notNull().default(true),
  telegram: boolean("telegram").notNull().default(true),
  /** Minutos desde la medianoche, hora de Argentina. Ambos nulos = sin silencio. */
  quietStartMin: smallint("quiet_start_min"),
  quietEndMin: smallint("quiet_end_min"),
  telegramChatId: text("telegram_chat_id"),
  telegramLinkedAt: ts("telegram_linked_at"),
});

/** Códigos de un solo uso para vincular Telegram (solo se guarda el hash). */
export const telegramLinkCodes = pgTable("telegram_link_codes", {
  codeHash: text("code_hash").primaryKey(),
  helperId: uuid("helper_id")
    .notNull()
    .references(() => helpers.id, { onDelete: "cascade" }),
  expiresAt: ts("expires_at").notNull(),
  usedAt: ts("used_at"),
});

export const helperAvailability = pgTable("helper_availability", {
  helperId: uuid("helper_id")
    .primaryKey()
    .references(() => helpers.id, { onDelete: "cascade" }),
  isOnCall: boolean("is_on_call").notNull().default(false),
  onCallSince: ts("on_call_since"),
  pausedUntil: ts("paused_until"),
});

export const verificationRequests = pgTable("verification_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  helperId: uuid("helper_id")
    .notNull()
    .references(() => helpers.id, { onDelete: "cascade" }),
  documentsRef: text("documents_ref")
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),
  notes: text("notes"),
  decision: text("decision"),
  decisionReason: text("decision_reason"),
  decidedBy: text("decided_by").references(() => authUsers.id),
  decidedAt: ts("decided_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const alerts = pgTable(
  "alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    anonSessionId: uuid("anon_session_id").references(() => anonSessions.id, {
      onDelete: "set null",
    }),
    path: alertPathEnum("path").notNull(),
    dangerNow: dangerNowEnum("danger_now").notNull(),
    safeTimeToWrite: safeTimeEnum("safe_time_to_write"),
    helperGenderPref: helperGenderPrefEnum("helper_gender_pref"),
    h3Cell: text("h3_cell"),
    cellCenter: geographyPoint("cell_center"),
    regionCode: text("region_code"),
    language: text("language").notNull().default("es"),
    status: alertStatusEnum("status").notNull().default("open"),
    escalationLevel: smallint("escalation_level").notNull().default(0),
    /** Momento desde el que corren los tiempos de escalado (creación o reapertura). */
    roundStartedAt: ts("round_started_at").notNull().defaultNow(),
    /** Cuántas veces la persona pidió otra persona (cada vuelta vuelve a avisar). */
    round: smallint("round").notNull().default(0),
    crisisLinesShownAt: ts("crisis_lines_shown_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
    claimedAt: ts("claimed_at"),
    closedAt: ts("closed_at"),
    closeReason: text("close_reason"),
    anonymizedAt: ts("anonymized_at"),
  },
  (t) => [
    index("alerts_open_idx")
      .on(t.status)
      .where(sql`${t.status} IN ('open', 'claimed')`),
    index("alerts_session_idx").on(t.anonSessionId),
    index("alerts_cell_center_gist").using("gist", t.cellCenter),
  ],
);

export const alertClaims = pgTable(
  "alert_claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    alertId: uuid("alert_id")
      .notNull()
      .references(() => alerts.id, { onDelete: "cascade" }),
    helperId: uuid("helper_id")
      .notNull()
      .references(() => helpers.id, { onDelete: "cascade" }),
    claimedAt: ts("claimed_at").notNull().defaultNow(),
    /** Nivel de escalado en el que se tomó (métricas). */
    escalationLevel: smallint("escalation_level").notNull().default(0),
    /** Cuánto tardó en tomarse desde el inicio de la vuelta (métricas). */
    waitMs: integer("wait_ms"),
    firstMessageAt: ts("first_message_at"),
    releasedAt: ts("released_at"),
    releaseReason: text("release_reason"),
  },
  (t) => [index("alert_claims_alert_idx").on(t.alertId)],
);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    alertId: uuid("alert_id")
      .notNull()
      .references(() => alerts.id, { onDelete: "cascade" }),
    claimId: uuid("claim_id")
      .notNull()
      .references(() => alertClaims.id, { onDelete: "cascade" }),
    helperId: uuid("helper_id")
      .notNull()
      .references(() => helpers.id, { onDelete: "cascade" }),
    anonSessionId: uuid("anon_session_id").references(() => anonSessions.id, {
      onDelete: "set null",
    }),
    startedAt: ts("started_at").notNull().defaultNow(),
    lastMessageAt: ts("last_message_at"),
    endedAt: ts("ended_at"),
    endedBy: text("ended_by"),
    endReason: text("end_reason"),
    /** Resumen privado opcional del ayudante, cifrado como los mensajes. */
    helperNoteCiphertext: bytea("helper_note_ciphertext"),
    helperNoteNonce: bytea("helper_note_nonce"),
    helperNoteKeyVersion: integer("helper_note_key_version"),
  },
  (t) => [
    index("conversations_helper_idx").on(t.helperId),
    index("conversations_alert_idx").on(t.alertId),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    sender: messageSenderEnum("sender").notNull(),
    ciphertext: bytea("ciphertext").notNull(),
    nonce: bytea("nonce").notNull(),
    keyVersion: integer("key_version").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("messages_conversation_idx").on(t.conversationId, t.createdAt)],
);

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerType: partyEnum("owner_type").notNull(),
    anonSessionId: uuid("anon_session_id").references(() => anonSessions.id, {
      onDelete: "cascade",
    }),
    helperId: uuid("helper_id").references(() => helpers.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("push_subscriptions_helper_idx").on(t.helperId),
    index("push_subscriptions_anon_idx").on(t.anonSessionId),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    helperId: uuid("helper_id")
      .notNull()
      .references(() => helpers.id, { onDelete: "cascade" }),
    alertId: uuid("alert_id")
      .notNull()
      .references(() => alerts.id, { onDelete: "cascade" }),
    channel: notificationChannelEnum("channel").notNull(),
    round: smallint("round").notNull().default(0),
    status: notificationStatusEnum("status").notNull().default("queued"),
    sentAt: ts("sent_at"),
    error: text("error"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("notifications_once_idx").on(t.helperId, t.alertId, t.channel, t.round),
    index("notifications_alert_idx").on(t.alertId),
  ],
);

export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  reporter: partyEnum("reporter").notNull(),
  reason: text("reason").notNull(),
  details: text("details"),
  status: text("status").notNull().default("open"),
  createdAt: ts("created_at").notNull().defaultNow(),
  resolvedAt: ts("resolved_at"),
});

/** Auditoría. Solo inserciones (ver migración: trigger que impide UPDATE/DELETE). */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorType: text("actor_type").notNull(),
    actorId: text("actor_id"),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("audit_log_target_idx").on(t.targetType, t.targetId)],
);
