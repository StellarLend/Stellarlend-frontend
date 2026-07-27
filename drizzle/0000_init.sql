CREATE TABLE IF NOT EXISTS "accounts" (
	"user_id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"bio" text NOT NULL DEFAULT '',
	"website" text NOT NULL DEFAULT '',
	"timezone" text NOT NULL DEFAULT 'UTC',
	"updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"read" boolean NOT NULL DEFAULT false,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"type" text NOT NULL DEFAULT 'info'
);

CREATE TABLE IF NOT EXISTS "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"amount" double precision NOT NULL,
	"asset" text NOT NULL,
	"date" text NOT NULL,
	"time" text NOT NULL,
	"status" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"details" jsonb,
	"created_at" timestamp NOT NULL DEFAULT now()
);
