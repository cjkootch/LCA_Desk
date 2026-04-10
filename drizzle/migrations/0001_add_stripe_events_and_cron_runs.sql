CREATE TABLE "stripe_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"processed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cron_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_name" text NOT NULL,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"status" text DEFAULT 'running' NOT NULL,
	"records_processed" integer DEFAULT 0,
	"error_message" text,
	"duration_ms" integer
);
