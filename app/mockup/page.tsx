"use client";

import { useState } from "react";

import { DashboardView } from "@/components/mockup/DashboardView";
import { RunDetailView } from "@/components/mockup/RunDetailView";
import { MockupSidebar, MockupTopBar } from "@/components/mockup/Shell";
import { ViewSwitch } from "@/components/mockup/primitives";

type MockView = "dashboard" | "detail";

export default function MockupPage() {
  const [view, setView] = useState<MockView>("dashboard");

  return (
    <div className="relative min-h-screen bg-mockup-bg font-mockup text-mockup-text">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(245,166,35,0.10),transparent_34%),radial-gradient(circle_at_90%_100%,rgba(245,166,35,0.05),transparent_30%)]" />

      <div className="relative flex min-h-screen">
        <MockupSidebar view={view} onViewChange={setView} />

        <div className="flex min-w-0 flex-1 flex-col">
          <MockupTopBar />

          <main className="flex-1 px-4 py-4 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-[1500px]">
              <div className="mb-2.5 flex items-center justify-between gap-3">
                <span className="font-mockup-mono text-[8px] font-medium uppercase tracking-[0.18em] text-mockup-dim">
                  Mockup preview / static data
                </span>
                <ViewSwitch view={view} onChange={setView} />
              </div>

              {view === "dashboard" ? (
                <DashboardView onOpenRun={() => setView("detail")} />
              ) : (
                <RunDetailView onBack={() => setView("dashboard")} />
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
