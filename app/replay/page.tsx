"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { formatDateTime, shortId } from "@/components/format";
import { Icon } from "@/components/mockup/Icon";
import { AppShell } from "@/components/mockup/Shell";
import {
  Badge,
  Panel,
  PanelHeader,
  cx,
} from "@/components/mockup/primitives";
import type { RunSummaryView, RunsResponse } from "@/components/types";

const SECRET_STORAGE_KEY = "odysseus.operator-secret";

type ToastTone = "success" | "error" | "warning";

interface ToastState {
  message: string;
  tone: ToastTone;
}

interface ReplayResponse {
  success?: boolean;
  runId?: string;
  error?: string;
}

const toastClasses: Record<ToastTone, string> = {
  success: "border-mockup-green/30 bg-[#0d1f17] text-mockup-green",
  error: "border-mockup-red/30 bg-[#211016] text-mockup-red",
  warning: "border-mockup-amber/30 bg-[#211a0d] text-mockup-amber",
};

function InlineSpinner({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        "inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
      aria-hidden="true"
    />
  );
}

function ReplayEmptyState() {
  return (
    <div className="px-5 py-16 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center border border-mockup-amber/20 bg-mockup-amber/10 text-mockup-amber">
        <Icon name="clock" className="h-4 w-4" />
      </div>
      <p className="mt-4 font-mockup text-[14px] font-medium text-mockup-text">
        No snapshots available.
      </p>
      <p className="mx-auto mt-2 max-w-md text-[11px] leading-5 text-mockup-muted">
        Run the pipeline first to create a stored MAG7.ssi snapshot. Replay
        uses the saved market data and never re-fetches SoSoValue.
      </p>
      <Link
        href="/dashboard"
        className="mt-5 inline-flex h-8 items-center gap-2 bg-mockup-amber px-3 font-mockup text-[11px] font-semibold text-black shadow-mockup-glow transition hover:bg-mockup-amber-soft"
      >
        <Icon name="dashboard" className="h-3 w-3" />
        Go to dashboard
      </Link>
    </div>
  );
}

function ReplaySkeleton() {
  return (
    <div className="divide-y divide-mockup-line/70">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="flex animate-pulse items-center gap-4 px-4 py-3.5"
        >
          <div className="h-2.5 w-32 bg-white/[0.04]" />
          <div className="h-2.5 w-20 bg-white/[0.04]" />
          <div className="ml-auto h-5 w-16 bg-white/[0.04]" />
          <div className="h-7 w-20 bg-white/[0.04]" />
        </div>
      ))}
    </div>
  );
}

export default function ReplayPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<RunSummaryView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState("");
  const [secretLoaded, setSecretLoaded] = useState(false);
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const latestRunId = runs[0]?.id ?? null;

  const showToast = useCallback((message: string, tone: ToastTone) => {
    setToast({ message, tone });
  }, []);

  const loadRuns = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/runs", { cache: "no-store" });

      if (!response.ok) {
        throw new Error("Failed to load stored snapshots.");
      }

      const payload = (await response.json()) as RunsResponse;
      setRuns(Array.isArray(payload.runs) ? payload.runs : []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load stored snapshots.",
      );
    } finally {
      setLoading(false);
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

  async function handleReplay(snapshotId: string) {
    if (replayingId) {
      return;
    }

    const operatorKey = secret.trim();

    if (!operatorKey) {
      showToast("Enter the operator secret first.", "error");
      return;
    }

    setReplayingId(snapshotId);

    try {
      const response = await fetch("/api/run/replay", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-operator-key": operatorKey,
        },
        body: JSON.stringify({ snapshotId }),
      });
      const payload = (await response.json().catch(() => null)) as
        | ReplayResponse
        | null;

      if (response.status === 401) {
        showToast("Invalid operator secret.", "error");
        return;
      }

      if (response.status === 404) {
        showToast("Snapshot not found.", "error");
        return;
      }

      if (response.status === 409) {
        showToast("Run already exists for today", "warning");
        return;
      }

      if (!response.ok || !payload?.runId) {
        showToast(payload?.error ?? "Replay failed.", "error");
        return;
      }

      router.push(`/runs/${payload.runId}`);
    } catch {
      showToast("Could not reach the replay API.", "error");
    } finally {
      setReplayingId(null);
    }
  }

  return (
    <>
      <AppShell active="replay" latestRunId={latestRunId}>
        <div className="flex flex-col gap-4 border-b border-mockup-line pb-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 font-mockup-mono text-[8px] uppercase tracking-[0.16em] text-mockup-dim transition hover:text-mockup-text"
            >
              <Icon name="arrowLeft" className="h-3 w-3" />
              Back to console
            </Link>
            <p className="mt-3 font-mockup-mono text-[9px] font-medium uppercase tracking-[0.24em] text-mockup-amber">
              Historical audit / replay
            </p>
            <h1 className="mt-2 font-mockup text-[26px] font-medium tracking-[-0.035em] text-mockup-text">
              REPLAY MODE
            </h1>
            <p className="mt-1 max-w-xl text-[12px] leading-5 text-mockup-muted">
              Re-run a stored snapshot through validation, deviation, agents,
              risk, and simulated execution. No SoSoValue ingestion.
            </p>
          </div>

          <label className="flex flex-col gap-1">
            <span className="font-mockup-mono text-[8px] uppercase tracking-[0.16em] text-mockup-dim">
              Operator secret
            </span>
            <input
              type="password"
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              placeholder="x-operator-key"
              autoComplete="off"
              spellCheck={false}
              className="h-8 w-full border border-mockup-line bg-mockup-panel px-2.5 font-mockup-mono text-[10px] text-mockup-text outline-none transition placeholder:text-mockup-dim/60 focus:border-mockup-amber/40 focus:ring-1 focus:ring-mockup-amber/20 sm:w-64"
            />
          </label>
        </div>

        <Panel className="mt-3">
          <PanelHeader
            title="Stored snapshots"
            action={
              <div className="flex items-center gap-2">
                <span className="font-mockup-mono text-[8px] uppercase tracking-[0.16em] text-mockup-dim">
                  {loading ? "Syncing..." : `${runs.length} snapshots`}
                </span>
                <button
                  type="button"
                  onClick={() => void loadRuns()}
                  disabled={loading}
                  className="flex h-7 items-center gap-1.5 border border-mockup-line bg-mockup-panel px-2 font-mockup-mono text-[8px] uppercase tracking-[0.14em] text-mockup-muted transition hover:border-mockup-line-strong hover:text-mockup-text disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
                    <InlineSpinner />
                  ) : (
                    <Icon name="activity" className="h-3 w-3" />
                  )}
                  Refresh
                </button>
              </div>
            }
          />

          {loading && runs.length === 0 ? (
            <ReplaySkeleton />
          ) : error ? (
            <div className="px-5 py-12 text-center">
              <p className="font-mockup-mono text-[10px] uppercase tracking-[0.14em] text-mockup-red">
                Could not load snapshots
              </p>
              <p className="mt-2 text-[11px] text-mockup-muted">{error}</p>
              <button
                type="button"
                onClick={() => void loadRuns()}
                className="mt-4 inline-flex h-8 items-center border border-mockup-red/30 bg-mockup-red/10 px-3 font-mockup-mono text-[9px] uppercase tracking-[0.14em] text-mockup-red transition hover:bg-mockup-red/15"
              >
                Retry
              </button>
            </div>
          ) : runs.length === 0 ? (
            <ReplayEmptyState />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-mockup-line">
                    {["Date", "Run ID", "Decision", "Action"].map((label) => (
                      <th
                        key={label}
                        className={cx(
                          "px-4 py-2.5 font-mockup-mono text-[8px] font-medium uppercase tracking-[0.2em] text-mockup-dim",
                          label === "Action" && "text-right",
                        )}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => {
                    const isReplaying = replayingId === run.id;
                    const decision = run.finalDecision ?? "PENDING";

                    return (
                      <tr
                        key={run.id}
                        className="border-b border-mockup-line/60 transition hover:bg-white/[0.02]"
                      >
                        <td className="whitespace-nowrap px-4 py-3 font-mockup-mono text-[10px] text-mockup-muted">
                          {formatDateTime(run.observedAt)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mockup-mono text-[10px] text-mockup-text">
                            {shortId(run.id)}
                          </span>
                          <span className="ml-2 font-mockup-mono text-[8px] uppercase tracking-[0.12em] text-mockup-dim">
                            {run.indexTicker}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Badge tone={decision === "SHORT" ? "amber" : "muted"}>
                              {decision}
                            </Badge>
                            <span className="font-mockup-mono text-[8px] uppercase tracking-[0.12em] text-mockup-dim">
                              {run.validationStatus}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => void handleReplay(run.id)}
                            disabled={replayingId !== null}
                            className="inline-flex h-7 items-center gap-1.5 border border-mockup-amber/30 bg-mockup-amber/10 px-2.5 font-mockup-mono text-[8px] font-medium uppercase tracking-[0.14em] text-mockup-amber transition hover:bg-mockup-amber/15 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isReplaying ? (
                              <InlineSpinner />
                            ) : (
                              <Icon name="play" className="h-3 w-3" />
                            )}
                            {isReplaying ? "Replaying..." : "Replay"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 font-mockup-mono text-[8px] uppercase tracking-[0.14em] text-mockup-dim">
          <span>Replay uses stored klines</span>
          <span className="h-2.5 w-px bg-mockup-line-strong" />
          <span>Execution is simulated</span>
          <span className="h-2.5 w-px bg-mockup-line-strong" />
          <span>New audit trail is persisted</span>
        </div>
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
