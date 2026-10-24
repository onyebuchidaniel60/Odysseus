CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "decision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid,
	"signal_id" uuid,
	"bull_output" jsonb,
	"bear_output" jsonb,
	"chief_output" jsonb,
	"final_decision" text NOT NULL,
	"no_trade_reason" text,
	"confidence" numeric,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "deviation_signal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid,
	"symbol" text NOT NULL,
	"weight" numeric NOT NULL,
	"constituent_return" numeric NOT NULL,
	"index_return" numeric NOT NULL,
	"weight_deviation" numeric NOT NULL,
	"z_score" numeric NOT NULL,
	"direction" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "execution" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"risk_check_id" uuid,
	"venue" text NOT NULL,
	"legs" jsonb NOT NULL,
	"client_order_id" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "execution_client_order_id_unique" UNIQUE("client_order_id")
);
--> statement-breakpoint
CREATE TABLE "index_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"index_ticker" text NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"index_klines" jsonb NOT NULL,
	"constituents" jsonb NOT NULL,
	"validation_status" text NOT NULL,
	"validation_reason" text,
	"tracking_error" numeric,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "risk_check" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"decision_id" uuid,
	"checks" jsonb NOT NULL,
	"approved" boolean NOT NULL,
	"approved_size" numeric,
	"stop_loss" numeric,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "decision" ADD CONSTRAINT "decision_snapshot_id_index_snapshot_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."index_snapshot"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision" ADD CONSTRAINT "decision_signal_id_deviation_signal_id_fk" FOREIGN KEY ("signal_id") REFERENCES "public"."deviation_signal"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deviation_signal" ADD CONSTRAINT "deviation_signal_snapshot_id_index_snapshot_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."index_snapshot"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution" ADD CONSTRAINT "execution_risk_check_id_risk_check_id_fk" FOREIGN KEY ("risk_check_id") REFERENCES "public"."risk_check"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_check" ADD CONSTRAINT "risk_check_decision_id_decision_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."decision"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_run_per_day" ON "index_snapshot" USING btree ("index_ticker",DATE("observed_at" AT TIME ZONE 'UTC'));