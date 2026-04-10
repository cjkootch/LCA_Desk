CREATE TABLE "user_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"event_name" text NOT NULL,
	"properties" jsonb DEFAULT '{}',
	"occurred_at" timestamp DEFAULT now(),
	"session_id" text
);
--> statement-breakpoint
CREATE INDEX "user_events_tenant_event_idx" ON "user_events" ("tenant_id","event_name");
--> statement-breakpoint
CREATE INDEX "user_events_user_time_idx" ON "user_events" ("user_id","occurred_at");
