import Link from 'next/link'
import { notFound } from 'next/navigation'

import { buildAuditComparison, comparisonHeadline } from '@/lib/audit-compare'
import { getAuditReport, getRecentAudits } from '@/lib/audit-store'

type SearchParams = Record<string, string | string[] | undefined>

function readParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0]
  }

  return value
}

function formatDelta(value: number | null) {
  if (value === null) {
    return 'n/a'
  }

  const prefix = value > 0 ? '+' : ''
  return `${prefix}${value}`
}

function formatMetric(value: number | null) {
  return value === null ? 'n/a' : value.toString()
}

export default async function AuditComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<SearchParams>
}) {
  const [{ id }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({}),
  ]) as [{ id: string }, SearchParams]
  const baseAudit = await getAuditReport(id)

  if (!baseAudit) {
    notFound()
  }

  const comparisonId = readParam(resolvedSearchParams.to)
  const recentAudits = (await getRecentAudits(20)).filter((audit) => audit.id !== id)
  const selectedComparisonId = comparisonId && comparisonId !== id ? comparisonId : recentAudits[0]?.id
  const comparisonAudit = selectedComparisonId ? await getAuditReport(selectedComparisonId) : null

  if (!comparisonAudit) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-10 text-white sm:px-10 lg:px-16">
        <section className="mx-auto max-w-5xl space-y-6">
          <Link href={`/audits/${id}`} className="text-sm font-medium text-cyan-300 hover:text-cyan-200">
            Back to report
          </Link>
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-300">
              Compare reports
            </p>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Choose a second audit to compare.
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-slate-300">
              {recentAudits.length > 0
                ? 'Select another saved report to compare scores, metrics, and priorities.'
                : 'Run another audit first so there is something to compare against.'}
            </p>
          </div>

          {recentAudits.length > 0 ? (
            <form
              method="get"
              className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 sm:flex-row"
            >
              <label className="flex-1">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Compare with
                </span>
                <select
                  name="to"
                  defaultValue={selectedComparisonId}
                  className="h-12 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 text-sm text-white outline-none focus:border-cyan-300"
                >
                  {recentAudits.map((audit) => (
                    <option key={audit.id} value={audit.id}>
                      {audit.targetUrl || 'Untitled audit'}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className="h-12 self-end rounded-2xl bg-cyan-300 px-5 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-200"
              >
                Compare
              </button>
            </form>
          ) : null}
        </section>
      </main>
    )
  }

  const comparison = buildAuditComparison(baseAudit, comparisonAudit)

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white sm:px-10 lg:px-16">
      <section className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <Link
              href={`/audits/${id}`}
              className="text-sm font-medium text-cyan-300 hover:text-cyan-200"
            >
              Back to report
            </Link>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-300">
              Compare reports
            </p>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              {comparison.baseAudit.results.targetUrl}
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-slate-300">
              {comparisonHeadline(comparison)}
            </p>
          </div>

          <form
            method="get"
            className="flex min-w-full flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 sm:min-w-[24rem]"
          >
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Compare with
              </span>
              <select
                name="to"
                defaultValue={comparisonAudit.id}
                className="h-12 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 text-sm text-white outline-none focus:border-cyan-300"
              >
                {recentAudits.map((audit) => (
                  <option key={audit.id} value={audit.id}>
                    {audit.targetUrl || 'Untitled audit'}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="h-12 rounded-2xl bg-cyan-300 px-5 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-200"
            >
              Update comparison
            </button>
          </form>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {[
            {
              label: 'Base',
              targetUrl: comparison.baseAudit.results.targetUrl,
              createdAt: comparison.baseAudit.createdAt,
            },
            {
              label: 'Comparison',
              targetUrl: comparison.comparisonAudit.results.targetUrl,
              createdAt: comparison.comparisonAudit.createdAt,
            },
          ].map((item) => (
            <article key={item.label} className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{item.label}</p>
              <h2 className="mt-3 text-2xl font-semibold text-white">{item.targetUrl}</h2>
              <p className="mt-2 text-sm text-slate-300">
                {new Intl.DateTimeFormat('en', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(item.createdAt)}
              </p>
            </article>
          ))}
        </div>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">Score changes</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {comparison.scoreComparisons.map((score) => (
              <article key={score.label} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{score.label}</p>
                <p className="mt-3 text-4xl font-semibold text-white">{score.comparison}%</p>
                <p className="mt-2 text-sm text-slate-300">
                  {score.base}% to {score.comparison}% ({formatDelta(score.delta)})
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold text-white">Metric changes</h2>
            <dl className="mt-5 space-y-4 text-sm">
              {comparison.metricComparisons.map((metric) => (
                <div
                  key={metric.label}
                  className="flex items-center justify-between border-b border-white/10 pb-3 last:border-b-0 last:pb-0"
                >
                  <dt className="text-slate-400">{metric.label}</dt>
                  <dd className="font-medium text-white">
                    {formatMetric(metric.base)} to {formatMetric(metric.comparison)} ({formatDelta(metric.delta)})
                  </dd>
                </div>
              ))}
            </dl>
          </article>

          <article className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold text-white">Crawl signals</h2>
            <dl className="mt-5 space-y-4 text-sm">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <dt className="text-slate-400">Pages crawled</dt>
                <dd className="font-medium text-white">
                  {comparison.baseAudit.results.crawl.pages.length} to {comparison.comparisonAudit.results.crawl.pages.length}
                </dd>
              </div>
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <dt className="text-slate-400">Internal URLs discovered</dt>
                <dd className="font-medium text-white">
                  {comparison.baseAudit.results.crawl.discoveredUrls.length} to {comparison.comparisonAudit.results.crawl.discoveredUrls.length}
                </dd>
              </div>
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <dt className="text-slate-400">Shared priorities</dt>
                <dd className="font-medium text-white">{comparison.sharedPriorities.length}</dd>
              </div>
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <dt className="text-slate-400">Pages in common</dt>
                <dd className="font-medium text-white">{comparison.sharedCrawlSignals.pages}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-400">URLs in common</dt>
                <dd className="font-medium text-white">{comparison.sharedCrawlSignals.discoveredUrls}</dd>
              </div>
            </dl>
          </article>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <article className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold text-white">Shared priorities</h2>
            <div className="mt-4 space-y-3">
              {comparison.sharedPriorities.length > 0 ? (
                comparison.sharedPriorities.map((title) => (
                  <p key={title} className="rounded-2xl bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
                    {title}
                  </p>
                ))
              ) : (
                <p className="text-sm text-slate-400">No priorities overlapped.</p>
              )}
            </div>
          </article>

          <article className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold text-white">Only in base</h2>
            <div className="mt-4 space-y-3">
              {comparison.baseOnlyPriorities.length > 0 ? (
                comparison.baseOnlyPriorities.map((title) => (
                  <p key={title} className="rounded-2xl bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
                    {title}
                  </p>
                ))
              ) : (
                <p className="text-sm text-slate-400">No base-only priorities.</p>
              )}
            </div>
          </article>

          <article className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold text-white">Only in comparison</h2>
            <div className="mt-4 space-y-3">
              {comparison.comparisonOnlyPriorities.length > 0 ? (
                comparison.comparisonOnlyPriorities.map((title) => (
                  <p key={title} className="rounded-2xl bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
                    {title}
                  </p>
                ))
              ) : (
                <p className="text-sm text-slate-400">No comparison-only priorities.</p>
              )}
            </div>
          </article>
        </section>
      </section>
    </main>
  )
}
