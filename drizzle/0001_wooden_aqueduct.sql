DROP INDEX "idx_run_per_day";--> statement-breakpoint
ALTER TABLE "index_snapshot" ADD COLUMN "constituent_klines" jsonb;--> statement-breakpoint
ALTER TABLE "index_snapshot" ADD COLUMN "token_klines" jsonb;--> statement-breakpoint
ALTER TABLE "index_snapshot" ADD COLUMN "replay_of" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_run_per_day" ON "index_snapshot" USING btree ("index_ticker",DATE("observed_at" AT TIME ZONE 'UTC')) WHERE "index_snapshot"."replay_of" IS NULL;