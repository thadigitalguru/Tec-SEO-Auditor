'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

interface ScheduleSummary {
  id: string
  cadenceDays: number
  nextRunAt: string
  lastRunAt: string | null
  active: boolean
}

interface ScheduleRunSummary {
  id: string
  auditId: string | null
  status: 'success' | 'failed'
  error: string | null
  runAt: string
}

interface ScheduleControlsProps {
  auditId: string
  targetUrl: string
  existingSchedule?: ScheduleSummary | null
  recentRuns?: ScheduleRunSummary[]
}

const CADENCE_OPTIONS = [7, 14, 30] as const

export function ScheduleControls({
  auditId,
  targetUrl,
  existingSchedule,
  recentRuns = [],
}: ScheduleControlsProps) {
  const router = useRouter()
  const [cadenceDays, setCadenceDays] = useState(existingSchedule?.cadenceDays ?? 7)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)

    startTransition(async () => {
      try {
        const response = await fetch('/api/schedules', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            auditId,
            targetUrl,
            cadenceDays,
          }),
        })

        const payload = (await response.json()) as
          | { schedule: ScheduleSummary }
          | { error: string }

        if (!response.ok) {
          setMessage('error' in payload ? payload.error : 'Unable to schedule audit.')
          return
        }

        setMessage('Schedule saved. The next re-audit will run automatically.')
        router.refresh()
      } catch {
        setMessage('Unable to schedule audit.')
      }
    })
  }

  async function handleRetry() {
    if (!existingSchedule) {
      return
    }

    setMessage(null)

    startTransition(async () => {
      try {
        const response = await fetch(`/api/schedules/${existingSchedule.id}/run`, {
          method: 'POST',
        })

        const payload = (await response.json()) as
          | { audit: { id: string } }
          | { error: string }

        if (!response.ok) {
          setMessage('error' in payload ? payload.error : 'Unable to run schedule.')
          return
        }

        setMessage('Schedule run queued. Refreshing audit history.')
        router.refresh()
      } catch {
        setMessage('Unable to run schedule.')
      }
    })
  }

  return (
    <article className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">Scheduled re-audits</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Keep this URL on a cadence so new audits are generated automatically.
          </p>
        </div>
        {existingSchedule ? (
          <span className="rounded-full border border-cyan-300/30 px-3 py-1 text-xs uppercase tracking-[0.2em] text-cyan-200">
            Active
          </span>
        ) : (
          <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-400">
            Inactive
          </span>
        )}
      </div>

      {existingSchedule ? (
        <div className="mt-5 grid gap-3 rounded-2xl bg-slate-950/60 p-4 text-sm text-slate-300 sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Cadence</p>
            <p className="mt-1 text-white">{existingSchedule.cadenceDays} days</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Next run</p>
            <p className="mt-1 text-white">
              {new Intl.DateTimeFormat('en', {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(existingSchedule.nextRunAt))}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Last run</p>
            <p className="mt-1 text-white">
              {existingSchedule.lastRunAt
                ? new Intl.DateTimeFormat('en', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(existingSchedule.lastRunAt))
                : 'Never'}
            </p>
          </div>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end">
        <label className="flex-1">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Re-audit every
          </span>
          <select
            value={cadenceDays}
            onChange={(event) => setCadenceDays(Number(event.target.value))}
            className="h-12 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 text-sm text-white outline-none focus:border-cyan-300"
          >
            {CADENCE_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value} days
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="h-12 rounded-2xl bg-cyan-300 px-5 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? 'Saving schedule...' : existingSchedule ? 'Update schedule' : 'Save schedule'}
        </button>
      </form>

      {message ? <p className="mt-4 text-sm text-slate-300">{message}</p> : null}

      {recentRuns.length > 0 ? (
        <div className="mt-6 rounded-2xl bg-slate-950/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
              Recent runs
            </h3>
            {existingSchedule ? (
              <button
                type="button"
                onClick={handleRetry}
                className="rounded-full border border-white/15 px-3 py-1 text-xs font-medium text-white transition-colors hover:border-cyan-300/60 hover:text-cyan-200"
              >
                Run now
              </button>
            ) : null}
          </div>
          <div className="mt-3 space-y-3">
            {recentRuns.map((run) => (
              <div
                key={run.id}
                className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-300"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-white">{run.status}</span>
                  <span className="text-slate-400">
                    {new Intl.DateTimeFormat('en', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(run.runAt))}
                  </span>
                </div>
                {run.error ? <p className="mt-2 text-rose-200">{run.error}</p> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  )
}
