ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "google_map_link" text;--> statement-breakpoint
ALTER TABLE "calls" DROP CONSTRAINT IF EXISTS "calls_ai_agent_id_ai_agents_id_fk";--> statement-breakpoint
DROP INDEX IF EXISTS "calls_ai_agent_id_idx";--> statement-breakpoint
ALTER TABLE "calls" DROP COLUMN IF EXISTS "ai_agent_id";--> statement-breakpoint
DROP INDEX IF EXISTS "ai_agents_business_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "ai_agents_phone_number_idx";--> statement-breakpoint
DROP TABLE IF EXISTS "ai_agents";--> statement-breakpoint
DROP TYPE IF EXISTS "ai_agent_status";--> statement-breakpoint
