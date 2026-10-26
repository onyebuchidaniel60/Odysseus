"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { DashboardView } from "@/components/mockup/DashboardView";
import { AppShell } from "@/components/mockup/Shell";
import type {
  PipelineResultView,
  RunDetailResponse,
  RunSummaryView,
  RunsResponse,
} from "@/components/types";

const SECRET_STORAGE_KEY = "odysseus.operator-secret";

type ToastTone = "success" | "error" | "warning";

interface ToastState {
  message: string;
  tone: ToastTone;
}

const toastClasses: Record<ToastTone, string> = {
  success: "border-mockup-green/30 bg-[#0d1f17] text-mockup-green",
  error: "border-mockup-red/30 bg-[#211016] text-mockup-red",
  warning: "border-mockup-amber/30 bg-[#211a0d] text-mockup-amber",
};

function errorMessage(payload: unknown, fallback: string): string {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof (payload as { error?: unknown }).error === "string"
  ) {
    return (payload as { error: string }).error;
  }

  return fallback;
}

export default function DashboardPage() {
  const router = useRouter();
  const [secret, setSecret] = useState("");
  const [secretLoaded, setSecretLoaded] = useState(false);
  const [runs, setRuns] = useState<RunSummaryView[]>([]);
  const [latestDetail, setLatestDetail] = useState<RunDetailResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [latestLoading, setLatestLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestError, setLatestError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const latestRunId = runs[0]?.id ?? null;

  const showToast = useCallback((message: string, tone: ToastTone) => {
    setToast({ message, tone });
  }, []);

  const loadRuns = useCallback(async (showSpinner = true) => {
    if (showSpinner) {
      setLoading(true);
    }

    setError(null);

    try {
      const response = await fetch("/api/runs", { cache: "no-store" });

      if (!response.ok) {
        throw new Error("Failed to load recent runs.");
      }

      const payload = (await response.json()) as RunsResponse;
      setRuns(Array.isArray(payload.runs) ? payload.runs : []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load recent runs.",
      );
    } finally {
      if (showSpinner) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    if (!latestRunId) {
      setLatestDetail(null);
      setLatestError(null);
      setLatestLoading(false);
      return;
    }

    let cancelled = false;

    setLatestLoading(true);
    setLatestError(null);
    setLatestDetail((current) =>
      current?.snapshot.id === latestRunId ? current : null,
    );

    fetch(`/api/runs/${latestRunId}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | RunDetailResponse
          | { error?: string }
          | null;

        if (!response.ok || !payload || !("snapshot" in payload)) {
          throw new Error(
            payload && "error" in payload && payload.error
              ? payload.error
              : "Failed to load latest run detail.",
          );
        }

        if (!cancelled) {
          setLatestDetail(payload);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setLatestDetail(null);
          setLatestError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load latest run detail.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLatestLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [latestRunId]);

  useEffect(() => {
    try {
      setSecret(window.localStorage.getItem(SECRET_STORAGE_KEY) ?? "");
    } catch {
      setSecret("");
    }

    setSecretLoaded(true);
  }, []);

  useEffect(() => {
    if (!secretLoaded) {
      return;
    }

    try {
      window.localStorage.setItem(SECRET_STORAGE_KEY, secret);
    } catch {
      return;
    }
  }, [secret, secretLoaded]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => {
      setToast(null);
    }, 4500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [toast]);

  async function handleRun() {
    if (running) {
      return;
    }

    const operatorKey = secret.trim();

    if (!operatorKey) {
      showToast("Enter the operator secret first.", "error");
      return;
    }

    setRunning(true);

    try {
      const response = await fetch("/api/run", {
        method: "POST",
        headers: {
          "x-operator-key": operatorKey,
        },
      });
      const payload = (await response.json().catch(() => null)) as
        | PipelineResultView
        | { error?: string }
        | null;

      if (response.status === 409) {
        showToast("Run already exists for today", "warning");
        return;
      }

      if (response.status === 401) {
        showToast("Invalid operator secret.", "error");
        return;
      }

      if (!response.ok) {
        showToast(
          errorMessage(payload, "Pipeline failed. Check server logs."),
          "error",
        );
        return;
      }

      const result = payload as PipelineResultView;
      showToast(
        result.decision === "SHORT"
          ? "Run complete — SHORT signal placed."
          : "Run complete — NO_TRADE.",
        "success",
      );
      await loadRuns(false);
    } catch {
      showToast("Could not reach the pipeline API.", "error");
    } finally {
      setRunning(false);
    }
  }

  function handleExportRuns() {
    if (runs.length === 0) {
      return;
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      runs,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `odysseus-runs-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function openRun(runId: string) {
    router.push(`/runs/${runId}`);
  }

  return (
    <>
      <AppShell active="dashboard" latestRunId={latestRunId}>
        <DashboardView
          runs={runs}
          latestDetail={latestDetail}
          loading={loading}
          latestLoading={latestLoading}
          error={error}
          latestError={latestError}
          secret={secret}
          onSecretChange={setSecret}
          onRun={() => void handleRun()}
          onRefresh={() => void loadRuns()}
          onExport={handleExportRuns}
          onOpenRun={openRun}
          running={running}
        />
      </AppShell>

      {toast ? (
        <div
          role="status"
          className={`fixed bottom-5 right-5 z-50 max-w-sm border px-4 py-3 font-mockup-mono text-[10px] uppercase tracking-[0.08em] shadow-2xl backdrop-blur ${toastClasses[toast.tone]}`}
        >
          {toast.message}
        </div>
      ) : null}
    </>
  );
}
