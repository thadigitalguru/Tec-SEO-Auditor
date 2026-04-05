'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

import type { AlertDeliveryChannel } from '@/lib/alert-store'

interface AlertRuleSummary {
  id: string
  dropPoints: number
  active: boolean
  deliveryChannel: AlertDeliveryChannel
  deliveryTarget: string | null
  cooldownHours: number
}

interface AlertEventSummary {
  id: string
  metricLabel: string
  previousScore: number
  currentScore: number
  delta: number
  createdAt: string
  deliveryChannel: string | null
  deliveryTarget: string | null
  deliveryStatus: string | null
  deliveryError: string | null
}

interface DeliverySummary {
  channel: string | null
  target: string | null
  status: string
  summary: string
}

interface AlertControlsProps {
  auditId: string
  targetUrl: string
  existingRule?: AlertRuleSummary | null
  recentEvents?: AlertEventSummary[]
  latestDelivery?: DeliverySummary | null
}

const THRESHOLD_OPTIONS = [3, 5, 10] as const
const COOLDOWN_OPTIONS = [0, 1, 6, 24, 72] as const
const DELIVERY_OPTIONS = [
  { value: 'webhook', label: 'Webhook' },
  { value: 'email', label: 'Email' },
] as const

export function AlertControls({
  auditId,
  targetUrl,
  existingRule,
  recentEvents = [],
  latestDelivery = null,
}: AlertControlsProps) {
  const router = useRouter()
  const [dropPoints, setDropPoints] = useState(existingRule?.dropPoints ?? 5)
  const [active, setActive] = useState(existingRule?.active ?? true)
  const [deliveryChannel, setDeliveryChannel] = useState<AlertDeliveryChannel>(
    existingRule?.deliveryChannel ?? 'webhook',
  )
  const [deliveryTarget, setDeliveryTarget] = useState(existingRule?.deliveryTarget ?? '')
  const [cooldownHours, setCooldownHours] = useState(existingRule?.cooldownHours ?? 24)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)

    const validationError = validateTarget(deliveryChannel, deliveryTarget)
    if (validationError) {
      setMessage(validationError)
      return
    }

    startTransition(async () => {
      try {
        const response = await fetch('/api/alerts', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            auditId,
            targetUrl,
            dropPoints,
            active,
            deliveryChannel,
            deliveryTarget,
            cooldownHours,
          }),
        })

        const payload = (await response.json()) as
          | { rule: AlertRuleSummary }
          | { error: string }

        if (!response.ok) {
          setMessage('error' in payload ? payload.error : 'Unable to save alert rule.')
          return
        }

        setMessage('Alert rule saved. Drops will be recorded on future audits.')
        router.refresh()
      } catch {
        setMessage('Unable to save alert rule.')
      }
    })
  }

  return (
    <article className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">Threshold alerts</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Alert when a later audit drops by a configured number of points versus the previous run.
          </p>
        </div>
        {existingRule ? (
          <span className="rounded-full border border-rose-300/30 px-3 py-1 text-xs uppercase tracking-[0.2em] text-rose-200">
            Active
          </span>
        ) : (
          <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-400">
            Inactive
          </span>
        )}
      </div>

      {existingRule ? (
        <div className="mt-5 rounded-2xl bg-slate-950/60 p-4 text-sm text-slate-300">
          Alert when any core score drops by {existingRule.dropPoints} or more points.
          <div className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-400">
            {existingRule.active ? 'Enabled' : 'Disabled'} via {existingRule.deliveryChannel}
            {existingRule.deliveryTarget ? ` to ${existingRule.deliveryTarget}` : ''}
            {' · '}
            cooldown {existingRule.cooldownHours}h
          </div>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="flex-1">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Drop threshold
          </span>
          <select
            value={dropPoints}
            onChange={(event) => setDropPoints(Number(event.target.value))}
            className="h-12 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 text-sm text-white outline-none focus:border-rose-300"
          >
            {THRESHOLD_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value} points
              </option>
            ))}
          </select>
        </label>
        <label className="flex-1">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Delivery channel
          </span>
          <select
            value={deliveryChannel}
            onChange={(event) => setDeliveryChannel(event.target.value as 'webhook' | 'email')}
            className="h-12 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 text-sm text-white outline-none focus:border-rose-300"
          >
            {DELIVERY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="sm:col-span-2">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Delivery target
          </span>
          <input
            value={deliveryTarget}
            onChange={(event) => setDeliveryTarget(event.target.value)}
            placeholder={deliveryChannel === 'email' ? 'alerts@example.com' : 'https://example.com/webhook'}
            className="h-12 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-rose-300"
          />
        </label>
        <label className="flex-1">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Cooldown
          </span>
          <select
            value={cooldownHours}
            onChange={(event) => setCooldownHours(Number(event.target.value))}
            className="h-12 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 text-sm text-white outline-none focus:border-rose-300"
          >
            {COOLDOWN_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value === 0 ? 'No cooldown' : `${value} hours`}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-3 sm:col-span-2">
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
            className="h-4 w-4 rounded border-white/20 bg-slate-950 text-rose-300 focus:ring-rose-300"
          />
          <span className="text-sm text-slate-300">Keep this alert rule active</span>
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={isPending}
            className="h-12 rounded-2xl bg-rose-300 px-5 text-sm font-semibold text-slate-950 transition-colors hover:bg-rose-200 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending ? 'Saving alert...' : existingRule ? 'Update alert' : 'Save alert'}
          </button>
        </div>
      </form>

      {message ? <p className="mt-4 text-sm text-slate-300">{message}</p> : null}

      {latestDelivery ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-300">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Latest delivery</p>
          <p className="mt-2 text-white">{latestDelivery.summary}</p>
          <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-400">
            {latestDelivery.status}
            {latestDelivery.channel ? ` · ${latestDelivery.channel}` : ''}
            {latestDelivery.target ? ` · ${latestDelivery.target}` : ''}
          </p>
        </div>
      ) : null}

      <div className="mt-6">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
          Recent drops
        </h3>
        <div className="mt-3 space-y-3">
          {recentEvents.length > 0 ? (
            recentEvents.map((event) => (
              <div key={event.id} className="rounded-2xl bg-slate-950/60 p-4 text-sm text-slate-300">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-white">{event.metricLabel}</span>
                  <span className="text-rose-200">{event.delta} points</span>
                </div>
                <p className="mt-2">
                  {event.previousScore} to {event.currentScore}
                </p>
                <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                  {event.deliveryStatus ?? 'queued'}
                  {event.deliveryError ? ` · ${event.deliveryError}` : ''}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-400">No score drops recorded yet.</p>
          )}
        </div>
      </div>
    </article>
  )
}

function validateTarget(channel: 'webhook' | 'email', value: string) {
  const target = value.trim()

  if (!target) {
    return 'A delivery target is required.'
  }

  if (channel === 'email') {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)
      ? null
      : 'Enter a valid email address.'
  }

  try {
    const url = new URL(target)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return 'Webhook URLs must use http or https.'
    }
    return null
  } catch {
    return 'Enter a valid webhook URL.'
  }
}
