'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

interface ScheduleActionsProps {
  scheduleId: string
  active: boolean
}

export function ScheduleActions({ scheduleId, active }: ScheduleActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleRunNow() {
    startTransition(async () => {
      await fetch(`/api/schedules/${scheduleId}/run`, { method: 'POST' })
      router.refresh()
    })
  }

  function handleToggle(nextActive: boolean) {
    startTransition(async () => {
      await fetch(`/api/schedules/${scheduleId}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ active: nextActive }),
      })
      router.refresh()
    })
  }

  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        onClick={handleRunNow}
        disabled={isPending}
        className="inline-flex h-11 items-center justify-center rounded-full bg-cyan-300 px-5 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-70"
      >
        Run now
      </button>
      <button
        type="button"
        onClick={() => handleToggle(!active)}
        disabled={isPending}
        className="inline-flex h-11 items-center justify-center rounded-full border border-white/15 px-5 text-sm font-medium text-white transition-colors hover:border-rose-300/60 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {active ? 'Deactivate schedule' : 'Activate schedule'}
      </button>
    </div>
  )
}
