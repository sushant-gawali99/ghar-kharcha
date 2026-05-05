ALTER TABLE "users" ADD COLUMN "terms_accepted_at" timestamp;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "privacy_accepted_at" timestamp;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ai_processing_consent_at" timestamp;
--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD COLUMN "family_id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
CREATE TABLE "used_refresh_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "family_id" uuid NOT NULL,
  "token_hash" text NOT NULL,
  "used_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "used_refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "action" text NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "used_refresh_tokens" ADD CONSTRAINT "used_refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
UPDATE "users"
SET
  "terms_accepted_at" = coalesce("terms_accepted_at", now()),
  "privacy_accepted_at" = coalesce("privacy_accepted_at", now())
WHERE "terms_accepted_at" IS NULL OR "privacy_accepted_at" IS NULL;
