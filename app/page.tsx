"use client";

import { useCallback, useEffect, useState } from "react";
import type { KeyboardEvent } from "react";
import { useRouter } from "next/navigation";

import { Spinner } from "@/components/Spinner";
import { StatusBadge } from "@/components/StatusBadge";
import { cn, formatDateTime, shortId } from "@/components/format";
import type {
  PipelineResultView,
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
  success: "border-success/30 bg-[#0d1f17] text-success",
  error: "border-danger/30 bg-[#211016] text-danger",
  warning: "border-warning/30 bg-[#211a0d] text-warning",
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

export default function Home() {
  const router = useRouter();
  const [secret, setSecret] = useState("");
  const [secretLoaded, setSecretLoaded] = useState(false);
  const [runs, setRuns] = useState<RunSummaryView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

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

  function openRun(runId: string) {
    router.push(`/runs/${runId}`);
  }

  function handleRowKeyDown(
    event: KeyboardEvent<HTMLTableRowElement>,
    runId: string,
  ) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openRun(runId);
    }
  }

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-grid-fade opacity-60" />

      <header className="relative z-20 border-b border-white/5 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <div className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_16px_rgba(79,140,255,0.85)]" />
              <h1 className="font-mono text-xl font-semibold tracking-[0.28em] text-foreground">
                ODYSSEUS
              </h1>
            </div>
            <p className="mt-1.5 text-sm text-muted">
              Autonomous SSI index-deviation agent · MAG7.ssi
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
                Operator secret
              </span>
              <input
                type="password"
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                placeholder="x-operator-key"
                autoComplete="off"
                spellCheck={false}
                className="h-10 w-full rounded-lg border border-white/10 bg-background/60 px-3 font-mono text-xs text-foreground outline-none transition placeholder:text-muted/50 focus:border-accent/60 focus:ring-2 focus:ring-accent/20 sm:w-60"
              />
            </label>

            <button
              type="button"
              onClick={() => void handleRun()}
              disabled={running}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-background shadow-accent transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {running ? <Spinner /> : <span aria-hidden="true">▶</span>}
              {running ? "Running..." : "Run Pipeline"}
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-20 pt-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
              Pipeline Console
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              Recent Runs
            </h2>
            <p className="mt-1 text-sm text-muted">
              One run per UTC day. Click a row to inspect the full audit trail.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadRuns()}
            disabled={loading}
            className="inline-flex h-9 w-fit items-center gap-2 rounded-lg border border-white/10 bg-surface px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted transition hover:border-accent/30 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? <Spinner /> : null}
            Refresh
          </button>
        </div>

        <div className="mt-6">
          {loading ? (
            <div className="overflow-hidden rounded-2xl border border-white/5 bg-surface">
              {[0, 1, 2].map((row) => (
                <div
                  key={row}
                  className="flex animate-pulse items-center gap-4 border-b border-white/[0.04] px-5 py-4 last:border-0"
                >
                  <div className="h-8 w-8 rounded-lg bg-white/5" />
                  <div className="h-3 w-24 rounded bg-white/5" />
                  <div className="ml-auto h-6 w-16 rounded-full bg-white/5" />
                  <div className="h-6 w-20 rounded-full bg-white/5" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-danger/20 bg-danger/[0.05] px-6 py-12 text-center">
              <p className="text-sm font-medium text-danger">
                Could not load recent runs.
              </p>
              <p className="mt-1 text-xs text-muted">{error}</p>
              <button
                type="button"
                onClick={() => void loadRuns()}
                className="mt-4 inline-flex h-9 items-center rounded-lg border border-danger/30 bg-danger/10 px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-danger transition hover:bg-danger/15"
              >
                Retry
              </button>
            </div>
          ) : runs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-surface/40 px-6 py-16 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-accent/20 bg-accent/10 font-mono text-lg text-accent">
                $
              </div>
              <p className="mt-4 text-sm font-medium text-foreground">
                No runs yet. Click &apos;Run Pipeline&apos; to start.
              </p>
              <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-muted">
                The first run fetches MAG7.ssi constituents and klines, evaluates
                the deviation, and persists every stage to Postgres.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-white/5 bg-surface shadow-panel">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/[0.02]">
                      <th className="px-5 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
                        Run
                      </th>
                      <th className="px-5 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
                        Timestamp
                      </th>
                      <th className="px-5 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
                        Validation
                      </th>
                      <th className="px-5 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
                        Decision
                      </th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((run) => (
                      <tr
                        key={run.id}
                        role="link"
                        tabIndex={0}
                        onClick={() => openRun(run.id)}
                        onKeyDown={(event) => handleRowKeyDown(event, run.id)}
                        className="group cursor-pointer border-b border-white/[0.04] transition-colors last:border-0 hover:bg-white/[0.03] focus:bg-white/[0.04] focus:outline-none"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/5 bg-background/60">
                              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                            </span>
                            <div>
                              <p
                                className="font-mono text-xs font-semibold text-foreground"
                                title={run.id}
                              >
                                {shortId(run.id)}
                              </p>
                              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                                {run.indexTicker}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 font-mono text-xs tabular-nums text-muted">
                          {formatDateTime(run.observedAt, true)}
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge
                            validationStatus={run.validationStatus}
                            size="sm"
                          />
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge decision={run.finalDecision} size="sm" />
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className="font-mono text-sm text-muted transition-colors group-hover:text-accent">
                            →
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <footer className="mt-10 flex flex-col gap-2 border-t border-white/5 pt-5 text-[10px] text-muted sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono uppercase tracking-[0.16em]">
            Odysseus · SSI deviation agent
          </p>
          <p className="font-mono uppercase tracking-[0.16em]">
            SoDEX testnet · MAG7.ssi
          </p>
        </footer>
      </main>

      {toast ? (
        <div
          role="status"
          className={cn(
            "fixed bottom-5 right-5 z-50 max-w-sm rounded-xl border px-4 py-3 font-mono text-xs shadow-2xl backdrop-blur",
            toastClasses[toast.tone],
          )}
        >
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}
