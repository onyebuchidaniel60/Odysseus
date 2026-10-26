"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { RunDetailView } from "@/components/mockup/RunDetailView";
import { AppShell } from "@/components/mockup/Shell";
import type { RunDetailResponse } from "@/components/types";

export default function RunDetailPage() {
  const { id: runId } = useParams<{ id: string }>();
  const [data, setData] = useState<RunDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRun = useCallback(async () => {
    if (!runId) {
      setError("Run id is missing.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/runs/${runId}`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | RunDetailResponse
        | { error?: string }
        | null;

      if (response.status === 404) {
        throw new Error("Run not found.");
      }

      if (!response.ok || !payload || !("snapshot" in payload)) {
        throw new Error(
          payload && "error" in payload && payload.error
            ? payload.error
            : "Failed to load run.",
        );
      }

      setData(payload);
    } catch (loadError) {
      setData(null);
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load run.",
      );
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    void loadRun();
  }, [loadRun]);

  function handleExport() {
    if (!data) {
      return;
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `odysseus-run-${data.snapshot.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell active="run" latestRunId={runId ?? null}>
      <RunDetailView
        data={data}
        loading={loading}
        error={error}
        onRetry={() => void loadRun()}
        onExport={handleExport}
      />
    </AppShell>
  );
}
