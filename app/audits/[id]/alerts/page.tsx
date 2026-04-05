import Link from 'next/link'
import { notFound } from 'next/navigation'

import { getAuditReport } from '@/lib/audit-store'
import { getAlertHistoryPageForTargetUrl } from '@/lib/alert-store'

type SearchParams = Record<string, string | string[] | undefined>

function readParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0]
  }

  return value
}

function toPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.max(1, Math.trunc(parsed))
}

export default async function AlertHistoryPage({
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
  const audit = await getAuditReport(id)

  if (!audit) {
    notFound()
  }

  const metric = readParam(resolvedSearchParams.metric) ?? ''
  const status = readParam(resolvedSearchParams.status) ?? ''
  const page = toPositiveInt(readParam(resolvedSearchParams.page), 1)
  const pageSize = toPositiveInt(readParam(resolvedSearchParams.pageSize), 10)
  const history = await getAlertHistoryPageForTargetUrl(audit.results.targetUrl, audit.userId, {
    metric,
    status,
    page,
    pageSize,
  })
  const { rule, events, total, totalPages, hasNextPage, hasPrevPage } = history

  const buildHref = (nextPage: number) => {
    const params = new URLSearchParams()
    if (metric) params.set('metric', metric)
    if (status) params.set('status', status)
    params.set('page', String(nextPage))
    params.set('pageSize', String(pageSize))
    const query = params.toString()
    return query ? `/audits/${id}/alerts?${query}` : `/audits/${id}/alerts`
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white sm:px-10 lg:px-16">
      <section className="mx-auto max-w-6xl space-y-8">
        <div className="space-y-3">
          <Link href={`/audits/${id}`} className="text-sm font-medium text-cyan-300 hover:text-cyan-200">
            Back to report
          </Link>
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-300">
            Threshold alerts
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Alert history
          </h1>
          <h2 className="text-2xl font-semibold tracking-tight text-white">
            {audit.results.targetUrl}
          </h2>
          <p className="max-w-3xl text-sm leading-7 text-slate-300">
            Review threshold drops, notification delivery results, and rule settings over time.
          </p>
        </div>

        {rule ? (
          <article className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
            Alert rule: drop by {rule.dropPoints} points, {rule.active ? 'enabled' : 'disabled'}.
            <span className="block text-slate-400">
              Delivery: {rule.deliveryChannel}
              {rule.deliveryTarget ? ` to ${rule.deliveryTarget}` : ''}
            </span>
          </article>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Link
            href={`/audits/${id}/alerts/export`}
            className="inline-flex h-11 items-center justify-center rounded-full border border-white/15 px-5 text-sm font-medium text-white transition-colors hover:border-cyan-300/60 hover:text-cyan-200"
          >
            Export JSON
          </Link>
          <Link
            href={`/audits/${id}/alerts/export?format=csv`}
            className="inline-flex h-11 items-center justify-center rounded-full border border-white/15 px-5 text-sm font-medium text-white transition-colors hover:border-cyan-300/60 hover:text-cyan-200"
          >
            Export CSV
          </Link>
        </div>

        <form method="get" className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 sm:flex-row">
          <label className="flex-1">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Metric
            </span>
            <select
              name="metric"
              defaultValue={metric}
              className="h-12 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 text-sm text-white outline-none focus:border-cyan-300"
            >
              <option value="">All metrics</option>
              <option value="performance">Performance</option>
              <option value="accessibility">Accessibility</option>
              <option value="bestPractices">Best practices</option>
              <option value="seo">SEO</option>
            </select>
          </label>
          <label className="flex-1">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Delivery status
            </span>
            <select
              name="status"
              defaultValue={status}
              className="h-12 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 text-sm text-white outline-none focus:border-cyan-300"
            >
              <option value="">All statuses</option>
              <option value="queued">Queued</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
              <option value="skipped">Skipped</option>
            </select>
          </label>
          <div className="flex items-end gap-3">
            <button
              type="submit"
              className="h-12 rounded-2xl bg-cyan-300 px-5 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-200"
            >
              Filter
            </button>
            <Link
              href={`/audits/${id}/alerts`}
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-white/15 px-5 text-sm font-medium text-white transition-colors hover:border-cyan-300/60 hover:text-cyan-200"
            >
              Reset
            </Link>
          </div>
        </form>

        <div className="space-y-4">
          {events.length > 0 ? (
            events.map((event) => (
              <article key={event.id} className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-white">{event.metricLabel}</h2>
                    <p className="mt-2 text-sm text-slate-400">
                      {new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(event.createdAt)}
                    </p>
                  </div>
                  <div className="text-right text-sm text-slate-300">
                    <p>{event.previousScore} to {event.currentScore}</p>
                    <p className="text-rose-200">{event.delta} points</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
                  <p>Status: <span className="text-white">{event.deliveryStatus ?? 'n/a'}</span></p>
                  <p>Channel: <span className="text-white">{event.deliveryChannel ?? 'n/a'}</span></p>
                  <p>Target: <span className="text-white">{event.deliveryTarget ?? 'n/a'}</span></p>
                </div>
                {event.deliveryError ? (
                  <p className="mt-3 text-sm text-rose-200">{event.deliveryError}</p>
                ) : null}
              </article>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-8 text-sm text-slate-400">
              No alert events match the current filters.
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 pt-2 text-sm text-slate-400">
          <p>
            Showing {events.length === 0 ? 0 : (page - 1) * pageSize + 1}-{Math.min(total, page * pageSize)} of {total}
          </p>
          <p>
            Page {history.page} of {totalPages}
          </p>
        </div>
        <div className="flex items-center justify-between gap-3">
          {hasPrevPage ? (
            <Link href={buildHref(history.page - 1)} className="text-cyan-300 hover:text-cyan-200">
              Previous
            </Link>
          ) : (
            <span className="text-slate-600">Previous</span>
          )}
          {hasNextPage ? (
            <Link href={buildHref(history.page + 1)} className="text-cyan-300 hover:text-cyan-200">
              Next
            </Link>
          ) : (
            <span className="text-slate-600">Next</span>
          )}
        </div>
      </section>
    </main>
  )
}
