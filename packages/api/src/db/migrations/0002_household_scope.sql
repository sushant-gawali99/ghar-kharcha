-- Introduce households + household invites so a family can share one ledger.

CREATE TABLE IF NOT EXISTS "households" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "monthly_budget" numeric(10, 2),
        "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "users" ADD COLUMN "household_id" uuid;
--> statement-breakpoint

ALTER TABLE "users" ADD CONSTRAINT "users_household_id_households_id_fk"
        FOREIGN KEY ("household_id") REFERENCES "public"."households"("id")
        ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

-- Backfill: every existing user becomes the sole member of a freshly-created
-- household. Their monthly_budget moves to the household.
INSERT INTO "households" ("id", "monthly_budget", "created_at")
SELECT gen_random_uuid(), "monthly_budget", now()
FROM "users";
--> statement-breakpoint

-- Pair each user with a household. We match by monthly_budget + a ROW_NUMBER
-- so users with identical or NULL budgets still get paired 1:1. Because both
-- inserts happen in the same order as the users, zipping by rank is safe here.
WITH ranked_users AS (
        SELECT "id", ROW_NUMBER() OVER (ORDER BY "created_at", "id") AS rn
        FROM "users"
),
ranked_households AS (
        SELECT "id", ROW_NUMBER() OVER (ORDER BY "created_at", "id") AS rn
        FROM "households"
)
UPDATE "users" u
SET "household_id" = rh.id
FROM ranked_users ru
JOIN ranked_households rh ON ru.rn = rh.rn
WHERE u.id = ru.id;
--> statement-breakpoint

ALTER TABLE "users" DROP COLUMN "monthly_budget";
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "household_invites" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "household_id" uuid NOT NULL,
        "inviter_id" uuid NOT NULL,
        "code" text NOT NULL,
        "expires_at" timestamp NOT NULL,
        "accepted_at" timestamp,
        "accepted_by_user_id" uuid,
        "created_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "household_invites_code_unique" UNIQUE("code")
);
--> statement-breakpoint

ALTER TABLE "household_invites" ADD CONSTRAINT "household_invites_household_id_households_id_fk"
        FOREIGN KEY ("household_id") REFERENCES "public"."households"("id")
        ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "household_invites" ADD CONSTRAINT "household_invites_inviter_id_users_id_fk"
        FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id")
        ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "household_invites" ADD CONSTRAINT "household_invites_accepted_by_user_id_users_id_fk"
        FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("id")
        ON DELETE set null ON UPDATE no action;
