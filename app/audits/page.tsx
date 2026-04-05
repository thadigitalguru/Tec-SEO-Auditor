import Link from 'next/link'

import { getAuditHistory } from '@/lib/audit-store'

type SearchParams = Record<string, string | string[] | undefined>

const PAGE_SIZE_OPTIONS = [6, 12, 24] as const

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value)
}

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

function toPageSize(value: string | undefined) {
  const parsed = toPositiveInt(value, 12)
  return PAGE_SIZE_OPTIONS.includes(parsed as (typeof PAGE_SIZE_OPTIONS)[number])
    ? parsed
    : 12
}

function buildAuditsHref(params: {
  q?: string
  order?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}) {
  const searchParams = new URLSearchParams()

  if (params.q) {
    searchParams.set('q', params.q)
  }

  if (params.order) {
    searchParams.set('order', params.order)
  }

  if (params.page) {
    searchParams.set('page', String(params.page))
  }

  if (params.pageSize) {
    searchParams.set('pageSize', String(params.pageSize))
  }

  const query = searchParams.toString()
  return query ? `/audits?${query}` : '/audits'
}

export default async function AuditsIndexPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>
}) {
  const resolvedSearchParams = (await searchParams) ?? {}
  const search = readParam(resolvedSearchParams.q)?.trim() ?? ''
  const order = readParam(resolvedSearchParams.order) === 'asc' ? 'asc' : 'desc'
  const page = toPositiveInt(readParam(resolvedSearchParams.page), 1)
  const pageSize = toPageSize(readParam(resolvedSearchParams.pageSize))

  const history = await getAuditHistory({
    search,
    order,
    page,
    pageSize,
  })

  const prevHref = history.hasPrevPage
    ? buildAuditsHref({
        q: history.search || undefined,
        order: history.order,
        page: history.page - 1,
        pageSize: history.pageSize,
      })
    : null
  const nextHref = history.hasNextPage
    ? buildAuditsHref({
        q: history.search || undefined,
        order: history.order,
        page: history.page + 1,
        pageSize: history.pageSize,
      })
    : null
  const startItem = history.total === 0 ? 0 : (history.page - 1) * history.pageSize + 1
  const endItem = Math.min(history.total, history.page * history.pageSize)

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white sm:px-10 lg:px-16">
      <section className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-300">
              Recent audits
            </p>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Saved reports and history
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-slate-300">
              Search prior reports by URL or summary, sort by age, and page through saved audits.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-full border border-white/15 px-5 text-sm font-medium text-white transition-colors hover:border-cyan-300/60 hover:text-cyan-200"
          >
            Run a new audit
          </Link>
        </div>

        <form
          method="get"
          className="grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,0.7fr)_minmax(0,0.5fr)_auto]"
        >
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Search
            </span>
            <input
              name="q"
              type="search"
              defaultValue={history.search}
              placeholder="Search by URL or summary"
              className="h-12 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Sort
            </span>
            <select
              name="order"
              defaultValue={history.order}
              className="h-12 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 text-sm text-white outline-none focus:border-cyan-300"
            >
              <option value="desc">Newest first</option>
              <option value="asc">Oldest first</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Page size
            </span>
            <select
              name="pageSize"
              defaultValue={history.pageSize}
              className="h-12 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 text-sm text-white outline-none focus:border-cyan-300"
            >
              {PAGE_SIZE_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value} per page
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end gap-3">
            <button
              type="submit"
              className="h-12 rounded-2xl bg-cyan-300 px-5 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-200"
            >
              Apply
            </button>
            {history.search || history.order !== 'desc' || history.pageSize !== 12 ? (
              <Link
                href="/audits"
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-white/15 px-5 text-sm font-medium text-white transition-colors hover:border-cyan-300/60 hover:text-cyan-200"
              >
                Reset
              </Link>
            ) : null}
          </div>
        </form>

        <div className="flex flex-col gap-3 border-b border-white/10 pb-4 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>
            {history.total === 0
              ? 'No audits match the current filters.'
              : `Showing ${startItem}-${endItem} of ${history.total} audits`}
          </p>
          <p>
            Page {history.page} of {history.totalPages}
          </p>
        </div>

        {history.audits.length > 0 ? (
          <>
            <div className="grid gap-4">
              {history.audits.map((audit) => (
                <Link
                  key={audit.id}
                  href={`/audits/${audit.id}`}
                  className="group rounded-3xl border border-white/10 bg-white/5 p-5 transition-colors hover:border-cyan-300/30 hover:bg-white/8"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                        {formatDate(audit.createdAt)}
                      </p>
                      <h2 className="text-xl font-semibold text-white group-hover:text-cyan-200">
                        {audit.targetUrl || 'Untitled audit'}
                      </h2>
                    </div>
                    <span className="text-sm text-slate-400">Open report</span>
                  </div>
                  <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300">
                    {audit.summary ?? 'No summary available.'}
                  </p>
                </Link>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 pt-4">
              {prevHref ? (
                <Link
                  href={prevHref}
                  className="inline-flex h-11 items-center justify-center rounded-full border border-white/15 px-5 text-sm font-medium text-white transition-colors hover:border-cyan-300/60 hover:text-cyan-200"
                >
                  Previous
                </Link>
              ) : (
                <span className="inline-flex h-11 items-center justify-center rounded-full border border-white/5 px-5 text-sm font-medium text-slate-600">
                  Previous
                </span>
              )}

              {nextHref ? (
                <Link
                  href={nextHref}
                  className="inline-flex h-11 items-center justify-center rounded-full border border-white/15 px-5 text-sm font-medium text-white transition-colors hover:border-cyan-300/60 hover:text-cyan-200"
                >
                  Next
                </Link>
              ) : (
                <span className="inline-flex h-11 items-center justify-center rounded-full border border-white/5 px-5 text-sm font-medium text-slate-600">
                  Next
                </span>
              )}
            </div>
          </>
        ) : (
          <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 p-8 text-sm text-slate-300">
            {history.search
              ? 'No audits matched that search. Try a different URL fragment or clear the filters.'
              : 'No audits have been saved yet. Run your first audit from the homepage.'}
          </div>
        )}
      </section>
    </main>
  )
}
