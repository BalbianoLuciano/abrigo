CREATE TYPE "public"."alert_path" AS ENUM('mental_health', 'violence');--> statement-breakpoint
CREATE TYPE "public"."alert_status" AS ENUM('open', 'claimed', 'active', 'closed');--> statement-breakpoint
CREATE TYPE "public"."danger_now" AS ENUM('yes', 'unsure', 'no');--> statement-breakpoint
CREATE TYPE "public"."helper_gender_pref" AS ENUM('woman', 'any');--> statement-breakpoint
CREATE TYPE "public"."helper_status" AS ENUM('pending', 'approved', 'rejected', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."message_sender" AS ENUM('anon', 'helper', 'system');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('web_push', 'email', 'telegram', 'expo_push');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('queued', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."party" AS ENUM('anon', 'helper');--> statement-breakpoint
CREATE TYPE "public"."safe_time_to_write" AS ENUM('yes', 'little', 'no');--> statement-breakpoint
CREATE TABLE "auth_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "auth_sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "auth_two_factors" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL,
	"verified" boolean DEFAULT true NOT NULL,
	"failed_verification_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "auth_users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" text DEFAULT 'helper_pending' NOT NULL,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "auth_verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alert_id" uuid NOT NULL,
	"helper_id" uuid NOT NULL,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"first_message_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"release_reason" text
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"anon_session_id" uuid,
	"path" "alert_path" NOT NULL,
	"danger_now" "danger_now" NOT NULL,
	"safe_time_to_write" "safe_time_to_write",
	"helper_gender_pref" "helper_gender_pref",
	"h3_cell" text,
	"region_code" text,
	"language" text DEFAULT 'es' NOT NULL,
	"status" "alert_status" DEFAULT 'open' NOT NULL,
	"escalation_level" smallint DEFAULT 0 NOT NULL,
	"round" smallint DEFAULT 0 NOT NULL,
	"crisis_lines_shown_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"claimed_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"close_reason" text,
	"anonymized_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "anon_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"previous_token_hash" text,
	"token_rotated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alert_id" uuid NOT NULL,
	"claim_id" uuid NOT NULL,
	"helper_id" uuid NOT NULL,
	"anon_session_id" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_message_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"ended_by" text,
	"end_reason" text,
	"helper_note_ciphertext" "bytea",
	"helper_note_nonce" "bytea",
	"helper_note_key_version" integer
);
--> statement-breakpoint
CREATE TABLE "helper_availability" (
	"helper_id" uuid PRIMARY KEY NOT NULL,
	"is_on_call" boolean DEFAULT false NOT NULL,
	"on_call_since" timestamp with time zone,
	"paused_until" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "helpers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"gender" text,
	"profession" text NOT NULL,
	"license_number" text,
	"license_jurisdiction" text,
	"organization" text,
	"specialties" "alert_path"[] NOT NULL,
	"languages" text[] DEFAULT ARRAY['es']::text[] NOT NULL,
	"bio_short" text,
	"coverage" geography(Polygon, 4326),
	"accepts_remote_anywhere" boolean DEFAULT true NOT NULL,
	"max_concurrent" smallint DEFAULT 2 NOT NULL,
	"status" "helper_status" DEFAULT 'pending' NOT NULL,
	"code_of_conduct_accepted_at" timestamp with time zone NOT NULL,
	"verified_by" text,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "helpers_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender" "message_sender" NOT NULL,
	"ciphertext" "bytea" NOT NULL,
	"nonce" "bytea" NOT NULL,
	"key_version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"helper_id" uuid NOT NULL,
	"alert_id" uuid NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"round" smallint DEFAULT 0 NOT NULL,
	"status" "notification_status" DEFAULT 'queued' NOT NULL,
	"sent_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_type" "party" NOT NULL,
	"anon_session_id" uuid,
	"helper_id" uuid,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"reporter" "party" NOT NULL,
	"reason" text NOT NULL,
	"details" text,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "verification_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"helper_id" uuid NOT NULL,
	"documents_ref" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"notes" text,
	"decision" text,
	"decision_reason" text,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_two_factors" ADD CONSTRAINT "auth_two_factors_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_claims" ADD CONSTRAINT "alert_claims_alert_id_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."alerts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_claims" ADD CONSTRAINT "alert_claims_helper_id_helpers_id_fk" FOREIGN KEY ("helper_id") REFERENCES "public"."helpers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_anon_session_id_anon_sessions_id_fk" FOREIGN KEY ("anon_session_id") REFERENCES "public"."anon_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_alert_id_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."alerts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_claim_id_alert_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."alert_claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_helper_id_helpers_id_fk" FOREIGN KEY ("helper_id") REFERENCES "public"."helpers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_anon_session_id_anon_sessions_id_fk" FOREIGN KEY ("anon_session_id") REFERENCES "public"."anon_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helper_availability" ADD CONSTRAINT "helper_availability_helper_id_helpers_id_fk" FOREIGN KEY ("helper_id") REFERENCES "public"."helpers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helpers" ADD CONSTRAINT "helpers_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helpers" ADD CONSTRAINT "helpers_verified_by_auth_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_helper_id_helpers_id_fk" FOREIGN KEY ("helper_id") REFERENCES "public"."helpers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_alert_id_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."alerts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_anon_session_id_anon_sessions_id_fk" FOREIGN KEY ("anon_session_id") REFERENCES "public"."anon_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_helper_id_helpers_id_fk" FOREIGN KEY ("helper_id") REFERENCES "public"."helpers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_helper_id_helpers_id_fk" FOREIGN KEY ("helper_id") REFERENCES "public"."helpers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_decided_by_auth_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_accounts_user_idx" ON "auth_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_sessions_user_idx" ON "auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_two_factors_user_idx" ON "auth_two_factors" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "alert_claims_alert_idx" ON "alert_claims" USING btree ("alert_id");--> statement-breakpoint
CREATE INDEX "alerts_open_idx" ON "alerts" USING btree ("status") WHERE "alerts"."status" IN ('open', 'claimed');--> statement-breakpoint
CREATE INDEX "alerts_session_idx" ON "alerts" USING btree ("anon_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "anon_sessions_token_idx" ON "anon_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "anon_sessions_prev_token_idx" ON "anon_sessions" USING btree ("previous_token_hash");--> statement-breakpoint
CREATE INDEX "audit_log_target_idx" ON "audit_log" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "conversations_helper_idx" ON "conversations" USING btree ("helper_id");--> statement-breakpoint
CREATE INDEX "conversations_alert_idx" ON "conversations" USING btree ("alert_id");--> statement-breakpoint
CREATE INDEX "helpers_status_idx" ON "helpers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "helpers_coverage_gist" ON "helpers" USING gist ("coverage");--> statement-breakpoint
CREATE INDEX "messages_conversation_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_once_idx" ON "notifications" USING btree ("helper_id","alert_id","channel","round");--> statement-breakpoint
CREATE INDEX "notifications_alert_idx" ON "notifications" USING btree ("alert_id");--> statement-breakpoint
CREATE INDEX "push_subscriptions_helper_idx" ON "push_subscriptions" USING btree ("helper_id");--> statement-breakpoint
CREATE INDEX "push_subscriptions_anon_idx" ON "push_subscriptions" USING btree ("anon_session_id");