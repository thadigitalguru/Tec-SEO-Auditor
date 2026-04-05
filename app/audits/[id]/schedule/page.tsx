import Link from 'next/link'
import { notFound } from 'next/navigation'

import { getAuditReport } from '@/lib/audit-store'
import { getScheduledAuditRunHistory } from '@/lib/schedule-engine'
import { getScheduledAuditsForTargetUrl } from '@/lib/schedule-store'
import { ScheduleActions } from './schedule-actions'

export default async function ScheduleHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const audit = await getAuditReport(id)

  if (!audit) {
    notFound()
  }

  const schedule = (await getScheduledAuditsForTargetUrl(audit.results.targetUrl, audit.userId))[0] ?? null
  const runs = schedule ? await getScheduledAuditRunHistory(schedule.id, audit.userId) : []

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white sm:px-10 lg:px-16">
      <section className="mx-auto max-w-6xl space-y-8">
        <div className="space-y-3">
          <Link href={`/audits/${id}`} className="text-sm font-medium text-cyan-300 hover:text-cyan-200">
            Back to report
          </Link>
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-300">
            Scheduled audits
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Run history
          </h1>
          <h2 className="text-2xl font-semibold tracking-tight text-white">
            {audit.results.targetUrl}
          </h2>
        </div>

        {schedule ? (
          <article className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Schedule</p>
                <p className="text-lg text-white">
                  Every {schedule.cadenceDays} days · {schedule.active ? 'active' : 'inactive'}
                </p>
              </div>
              <ScheduleActions scheduleId={schedule.id} active={schedule.active} />
            </div>
          </article>
        ) : (
          <article className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-6 text-sm text-slate-400">
            No schedule has been saved for this URL yet.
          </article>
        )}

        <div className="space-y-4">
          {runs.length > 0 ? (
            runs.map((run) => (
              <article key={run.id} className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-semibold text-white">
                      {run.status === 'success' ? 'Successful run' : 'Failed run'}
                    </h3>
                    <p className="mt-2 text-sm text-slate-400">
                      {new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(run.runAt)}
                    </p>
                  </div>
                  <div className="text-right text-sm text-slate-300">
                    <p>{run.auditId ?? 'No audit saved'}</p>
                    {run.error ? <p className="text-rose-200">{run.error}</p> : null}
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-8 text-sm text-slate-400">
              No run history yet.
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
