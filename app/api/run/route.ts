import { NextResponse } from "next/server";

import { getEnv, type Env } from "@/lib/env";
import { isAuthorizedOperator } from "@/lib/operator-auth";
import {
  RunAlreadyExistsError,
  runPipeline,
} from "@/lib/pipeline/orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

  try {
    const result = await runPipeline({
      mockSodex: env.MOCK_SODEX,
      forceDemoTrade: env.FORCE_DEMO_TRADE,
    });

    return NextResponse.json(result, { status: result.success ? 200 : 500 });
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
      "[api/run] pipeline failed:",
      error instanceof Error ? error.message : String(error),
    );

    return NextResponse.json({ error: "Pipeline failed" }, { status: 500 });
  }
}
