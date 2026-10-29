import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { indexSnapshot } from "@/lib/db/schema";
import { getEnv, type Env } from "@/lib/env";
import { isAuthorizedOperator } from "@/lib/operator-auth";
import {
  processSnapshot,
  RunAlreadyExistsError,
} from "@/lib/pipeline/orchestrator";
import type { Constituent, Kline } from "@/lib/sosovalue/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface ReplayRequestBody {
  snapshotId?: unknown;
}

function loadEnv(): Env | null {
  try {
    return getEnv();
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const env = loadEnv();

  if (!env) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  if (!isAuthorizedOperator(request, env)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | ReplayRequestBody
    | null;
  const snapshotId = body?.snapshotId;

  if (typeof snapshotId !== "string" || !UUID_PATTERN.test(snapshotId)) {
    return NextResponse.json(
      { error: "A valid snapshotId is required" },
      { status: 400 },
    );
  }

  try {
    const [snapshot] = await getDb()
      .select()
      .from(indexSnapshot)
      .where(eq(indexSnapshot.id, snapshotId))
      .limit(1);

    if (!snapshot) {
      return NextResponse.json(
        { error: "Snapshot not found" },
        { status: 404 },
      );
    }

    if (
      !snapshot.constituentKlines ||
      !snapshot.tokenKlines ||
      !Array.isArray(snapshot.indexKlines) ||
      !Array.isArray(snapshot.constituents)
    ) {
      return NextResponse.json(
        {
          error:
            "Snapshot does not include replay data. Run the pipeline again to create a replay-capable snapshot.",
        },
        { status: 422 },
      );
    }

    const result = await processSnapshot(
      {
        indexTicker: snapshot.indexTicker,
        observedAt: snapshot.observedAt,
        indexKlines: snapshot.indexKlines as Kline[],
        constituentKlines: snapshot.constituentKlines as Record<
          string,
          Kline[]
        >,
        tokenKlines: snapshot.tokenKlines as Kline[],
        constituents: snapshot.constituents as Constituent[],
        replayOf: snapshot.id,
      },
      { mockSodex: true, forceDemoTrade: env.FORCE_DEMO_TRADE },
    );

    if (!result.success || !result.runId) {
      return NextResponse.json(
        {
          error: result.error ?? "Replay failed",
          runId: result.runId,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      runId: result.runId,
    });
  } catch (error) {
    if (error instanceof RunAlreadyExistsError) {
      return NextResponse.json(
        {
          error: "Run already exists for today",
          runId: error.runId,
        },
        { status: 409 },
      );
    }

    console.error(
      "[api/run/replay] replay failed:",
      error instanceof Error ? error.message : String(error),
    );

    return NextResponse.json({ error: "Replay failed" }, { status: 500 });
  }
}
