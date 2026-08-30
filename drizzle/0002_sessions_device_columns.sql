ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "user_agent" text;
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "ip_address" text;
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "last_seen_at" timestamp NOT NULL DEFAULT now();
