import { asc, desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import {
  auditLog,
  decision,
  deviationSignal,
  execution,
  indexSnapshot,
  riskCheck,
} from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  if (!UUID_PATTERN.test(params.id)) {
    return NextResponse.json({ error: "Invalid run id" }, { status: 400 });
  }

  try {
    const db = getDb();
    const [snapshot] = await db
      .select()
      .from(indexSnapshot)
      .where(eq(indexSnapshot.id, params.id))
      .limit(1);

    if (!snapshot) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    const [signals, decisions, auditLogRows] = await Promise.all([
      db
        .select()
        .from(deviationSignal)
        .where(eq(deviationSignal.snapshotId, snapshot.id))
        .orderBy(desc(sql`abs(${deviationSignal.zScore})`)),
      db
        .select()
        .from(decision)
        .where(eq(decision.snapshotId, snapshot.id))
        .limit(1),
      db
        .select()
        .from(auditLog)
        .where(eq(auditLog.runId, snapshot.id))
        .orderBy(asc(auditLog.createdAt)),
    ]);

    const decisionRow = decisions[0] ?? null;
    let riskCheckRow: typeof riskCheck.$inferSelect | null = null;
    let executionRow: typeof execution.$inferSelect | null = null;

    if (decisionRow) {
      const [risk] = await db
        .select()
        .from(riskCheck)
        .where(eq(riskCheck.decisionId, decisionRow.id))
        .limit(1);
      riskCheckRow = risk ?? null;
    }

    if (riskCheckRow) {
      const [order] = await db
        .select()
        .from(execution)
        .where(eq(execution.riskCheckId, riskCheckRow.id))
        .limit(1);
      executionRow = order ?? null;
    }

    return NextResponse.json({
      snapshot,
      signals,
      decision: decisionRow,
      riskCheck: riskCheckRow,
      execution: executionRow,
      auditLog: auditLogRows,
    });
  } catch (error) {
    console.error(
      "[api/runs/:id] failed to load run:",
      error instanceof Error ? error.message : String(error),
    );

    return NextResponse.json(
      { error: "Failed to load run" },
      { status: 500 },
    );
  }
}
