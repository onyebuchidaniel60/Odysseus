import { NextResponse } from "next/server";

import { getEnv } from "@/lib/env";
import {
  RunAlreadyExistsError,
  runPipeline,
} from "@/lib/pipeline/orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let operatorSecret: string;
  let mockSodex: boolean;
  let forceDemoTrade: boolean;

  try {
    const env = getEnv();
    operatorSecret = env.OPERATOR_SECRET;
    mockSodex = env.MOCK_SODEX;
    forceDemoTrade = env.FORCE_DEMO_TRADE;
  } catch {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  const providedSecret = request.headers.get("x-operator-key");

  if (!providedSecret || providedSecret !== operatorSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runPipeline({ mockSodex, forceDemoTrade });

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
