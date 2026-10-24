import { NextResponse } from "next/server";

import { checkDatabase } from "@/lib/db";
import { getEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DependencyStatus = "ok" | "error";

export async function GET() {
  const checks: Record<"env" | "database", DependencyStatus> = {
    env: "error",
    database: "error",
  };

  try {
    getEnv();
    checks.env = "ok";
  } catch {
    checks.env = "error";
  }

  if (checks.env === "ok") {
    try {
      await checkDatabase();
      checks.database = "ok";
    } catch {
      checks.database = "error";
    }
  }

  const healthy = checks.env === "ok" && checks.database === "ok";

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  );
}
