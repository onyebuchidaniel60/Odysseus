export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-4 p-8">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-400">
        Odysseus
      </p>
      <h1 className="text-4xl font-semibold tracking-tight">
        SSI index-deviation agent
      </h1>
      <p className="max-w-xl text-slate-400">
        Foundation online. The pipeline dashboard arrives in Phase 7.
      </p>
      <a
        className="w-fit text-sm text-emerald-400 underline underline-offset-4"
        href="/api/health"
      >
        View dependency health
      </a>
    </main>
  );
}
