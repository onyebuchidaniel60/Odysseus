/**
 * Copy the persisted demo execution run from the local database to production.
 *
 * Usage:
 *   PROD_DATABASE_URL="postgres://..." npx tsx scripts/sync-demo-run.ts
 *
 * `DATABASE_URL` is read from .env.local; `PROD_DATABASE_URL` must point at the
 * production database. The script is idempotent and safe to re-run.
 */
import { config } from "dotenv";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../lib/db/schema";

config({ path: [".env.local", ".env"] });

const RUN_ID = "64c1368c-2bee-4172-9575-7c2c53fb0499";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required. Add it to .env.local or the shell.`);
  }
  return value;
}

async function main() {
  const localUrl = requireEnv("DATABASE_URL");
  const productionUrl = requireEnv("PROD_DATABASE_URL");

  if (localUrl === productionUrl) {
    throw new Error(
      "DATABASE_URL and PROD_DATABASE_URL point to the same database. Refusing to sync.",
    );
  }

  const localClient = postgres(localUrl, { max: 1, prepare: false });
  const productionClient = postgres(productionUrl, {
    max: 1,
    prepare: false,
  });
  const localDb = drizzle(localClient, { schema });
  const productionDb = drizzle(productionClient, { schema });

  try {
    console.log(`[sync] reading run ${RUN_ID} from local database`);

    const [snapshot] = await localDb
      .select()
      .from(schema.indexSnapshot)
      .where(eq(schema.indexSnapshot.id, RUN_ID));

    if (!snapshot) {
      throw new Error(`No index_snapshot found for run ${RUN_ID}.`);
    }

    const signals = await localDb
      .select()
      .from(schema.deviationSignal)
      .where(eq(schema.deviationSignal.snapshotId, RUN_ID));

    const decisions = await localDb
      .select()
      .from(schema.decision)
      .where(eq(schema.decision.snapshotId, RUN_ID));

    const decisionIds = decisions.map((row) => row.id);
    const riskChecks = decisionIds.length
      ? await localDb
          .select()
          .from(schema.riskCheck)
          .where(inArray(schema.riskCheck.decisionId, decisionIds))
      : [];

    const riskCheckIds = riskChecks.map((row) => row.id);
    const executions = riskCheckIds.length
      ? await localDb
          .select()
          .from(schema.execution)
          .where(inArray(schema.execution.riskCheckId, riskCheckIds))
      : [];

    const auditLogs = await localDb
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.runId, RUN_ID));

    console.log(
      `[sync] found snapshot=1 signals=${signals.length} decisions=${decisions.length} risk_checks=${riskChecks.length} executions=${executions.length} audit_logs=${auditLogs.length}`,
    );

    const copied = {
      snapshot: 0,
      signals: 0,
      decisions: 0,
      riskChecks: 0,
      executions: 0,
      auditLogs: 0,
    };

    await productionDb.transaction(async (tx) => {
      const insertedSnapshots = await tx
        .insert(schema.indexSnapshot)
        .values(snapshot)
        .onConflictDoNothing()
        .returning({ id: schema.indexSnapshot.id });
      copied.snapshot = insertedSnapshots.length;

      // A different run on the same UTC day can conflict with idx_run_per_day.
      // In that case the snapshot is skipped, so child inserts would fail their
      // foreign key. Surface that clearly instead of leaving a partial sync.
      const [productionSnapshot] = await tx
        .select({ id: schema.indexSnapshot.id })
        .from(schema.indexSnapshot)
        .where(eq(schema.indexSnapshot.id, RUN_ID))
        .limit(1);

      if (!productionSnapshot) {
        throw new Error(
          `The run snapshot was not inserted. Production already has a different non-replay run on ${snapshot.observedAt.toISOString().slice(0, 10)} (idx_run_per_day). Remove or replay that run first.`,
        );
      }

      if (signals.length > 0) {
        const inserted = await tx
          .insert(schema.deviationSignal)
          .values(signals)
          .onConflictDoNothing()
          .returning({ id: schema.deviationSignal.id });
        copied.signals = inserted.length;
      }

      if (decisions.length > 0) {
        const inserted = await tx
          .insert(schema.decision)
          .values(decisions)
          .onConflictDoNothing()
          .returning({ id: schema.decision.id });
        copied.decisions = inserted.length;
      }

      if (riskChecks.length > 0) {
        const inserted = await tx
          .insert(schema.riskCheck)
          .values(riskChecks)
          .onConflictDoNothing()
          .returning({ id: schema.riskCheck.id });
        copied.riskChecks = inserted.length;
      }

      if (executions.length > 0) {
        const inserted = await tx
          .insert(schema.execution)
          .values(executions)
          .onConflictDoNothing()
          .returning({ id: schema.execution.id });
        copied.executions = inserted.length;
      }

      if (auditLogs.length > 0) {
        const inserted = await tx
          .insert(schema.auditLog)
          .values(auditLogs)
          .onConflictDoNothing()
          .returning({ id: schema.auditLog.id });
        copied.auditLogs = inserted.length;
      }
    });

    const total = Object.values(copied).reduce((sum, value) => sum + value, 0);

    console.log(`[sync] success: run ${RUN_ID} synced to production`);
    console.log(
      `  index_snapshot: ${copied.snapshot} copied (${snapshot ? 1 : 0} found locally)`,
    );
    console.log(
      `  deviation_signal: ${copied.signals} copied (${signals.length} found locally)`,
    );
    console.log(
      `  decision: ${copied.decisions} copied (${decisions.length} found locally)`,
    );
    console.log(
      `  risk_check: ${copied.riskChecks} copied (${riskChecks.length} found locally)`,
    );
    console.log(
      `  execution: ${copied.executions} copied (${executions.length} found locally)`,
    );
    console.log(
      `  audit_log: ${copied.auditLogs} copied (${auditLogs.length} found locally)`,
    );
    console.log(`  total rows copied: ${total}`);
  } finally {
    await localClient.end();
    await productionClient.end();
  }
}

main().catch((error: unknown) => {
  console.error(
    `[sync] failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
