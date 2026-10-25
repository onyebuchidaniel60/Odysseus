import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { decision, indexSnapshot } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const runs = await getDb()
      .select({
        id: indexSnapshot.id,
        observedAt: indexSnapshot.observedAt,
        indexTicker: indexSnapshot.indexTicker,
        validationStatus: indexSnapshot.validationStatus,
        finalDecision: decision.finalDecision,
      })
      .from(indexSnapshot)
      .leftJoin(decision, eq(decision.snapshotId, indexSnapshot.id))
      .orderBy(desc(indexSnapshot.observedAt))
      .limit(20);

    return NextResponse.json({ runs });
  } catch (error) {
    console.error(
      "[api/runs] failed to load runs:",
      error instanceof Error ? error.message : String(error),
    );

    return NextResponse.json(
      { error: "Failed to load runs" },
      { status: 500 },
    );
  }
}
