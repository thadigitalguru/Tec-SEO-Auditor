import { AuditForm } from './audit-form'
import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#1f2937_0,_#0b1220_36%,_#05070d_100%)] px-6 py-10 text-white sm:px-10 lg:px-16">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl flex-col justify-between rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-2xl shadow-black/40 backdrop-blur sm:p-10">
        <div className="max-w-3xl space-y-6">
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-cyan-300">
            Tec SEO Auditor
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">
            Crawl pages, run Lighthouse, and turn findings into priorities.
          </h1>
          <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
            The audit engine now performs a real site crawl, attaches Chromium
            for Lighthouse, and generates an AI-ready summary for technical SEO
            work.
          </p>
          <AuditForm />
        </div>

        <div className="grid gap-4 pt-10 sm:grid-cols-3">
          {[
            {
              title: 'Crawl',
              body: 'Discover sitemap and internal links up to the configured limit.',
            },
            {
              title: 'Measure',
              body: 'Run Lighthouse against the target URL with a real browser session.',
            },
            {
              title: 'Prioritize',
              body: 'Summarize the audit with heuristic or OpenAI-backed insights.',
            },
          ].map((item) => (
            <article
              key={item.title}
              className="rounded-2xl border border-white/10 bg-slate-950/60 p-5"
            >
              <h2 className="text-lg font-semibold text-white">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">{item.body}</p>
            </article>
          ))}
        </div>

        <div className="pt-10 text-sm text-slate-400">
          Build, lint, and typecheck are wired into the new `pnpm check` script.
          {' '}
          <Link href="/audits" className="text-cyan-300 hover:text-cyan-200">
            Browse recent audits
          </Link>
        </div>
      </section>
    </main>
  );
}
