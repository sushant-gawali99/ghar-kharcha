-- Track whether a user has finished the first-run onboarding flow so we can
-- route to it on sign-in only while it's still pending.

ALTER TABLE "users" ADD COLUMN "onboarded_at" timestamp;
--> statement-breakpoint

-- Any existing user has already been using the app pre-onboarding; mark them
-- done so we don't shove them back into the welcome flow on next sign-in.
UPDATE "users" SET "onboarded_at" = now() WHERE "onboarded_at" IS NULL;
