CREATE TABLE "helper_notification_prefs" (
	"helper_id" uuid PRIMARY KEY NOT NULL,
	"web_push" boolean DEFAULT true NOT NULL,
	"email" boolean DEFAULT true NOT NULL,
	"telegram" boolean DEFAULT true NOT NULL,
	"quiet_start_min" smallint,
	"quiet_end_min" smallint,
	"telegram_chat_id" text,
	"telegram_linked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "telegram_link_codes" (
	"code_hash" text PRIMARY KEY NOT NULL,
	"helper_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "alert_claims" ADD COLUMN "escalation_level" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "alert_claims" ADD COLUMN "wait_ms" integer;--> statement-breakpoint
ALTER TABLE "alerts" ADD COLUMN "cell_center" geography(Point, 4326);--> statement-breakpoint
ALTER TABLE "alerts" ADD COLUMN "round_started_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "helpers" ADD COLUMN "region_codes" text[] DEFAULT ARRAY[]::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "helper_notification_prefs" ADD CONSTRAINT "helper_notification_prefs_helper_id_helpers_id_fk" FOREIGN KEY ("helper_id") REFERENCES "public"."helpers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_link_codes" ADD CONSTRAINT "telegram_link_codes_helper_id_helpers_id_fk" FOREIGN KEY ("helper_id") REFERENCES "public"."helpers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alerts_cell_center_gist" ON "alerts" USING gist ("cell_center");--> statement-breakpoint
CREATE INDEX "helpers_region_codes_gin" ON "helpers" USING gin ("region_codes");