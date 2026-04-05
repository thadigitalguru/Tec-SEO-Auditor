export default function AuditTargetPage() {
  return (
    <main className="min-h-screen bg-white px-8 py-16 text-slate-950">
      <section className="mx-auto max-w-2xl space-y-4">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">
          Lighthouse target
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">Audit target</h1>
        <p className="text-base leading-7 text-slate-600">
          This lightweight page exists so browser audits can run against a real
          live route without pulling in the full homepage experience.
        </p>
      </section>
    </main>
  )
}
