import type { ScoreAlertEvent } from './alert-store'
import type { StoredAudit } from './audit-store'

export interface ScoreTrendPoint {
  label: string
  createdAt: string
  performance: number
  accessibility: number
  bestPractices: number
  seo: number
}

export interface AlertTrendPoint {
  label: string
  createdAt: string
  alertCount: number
  totalDelta: number
  worstDelta: number
}

export function buildAuditTrendSeries(
  audits: StoredAudit[],
  limit = 8,
): ScoreTrendPoint[] {
  return audits
    .slice(0, limit)
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
    .map((audit) => ({
      label: formatTrendLabel(audit.createdAt),
      createdAt: audit.createdAt.toISOString(),
      performance: audit.results.lighthouse.scores.performance,
      accessibility: audit.results.lighthouse.scores.accessibility,
      bestPractices: audit.results.lighthouse.scores.bestPractices,
      seo: audit.results.lighthouse.scores.seo,
    }))
}

export function buildAlertTrendSeries(
  events: ScoreAlertEvent[],
  limit = 8,
): AlertTrendPoint[] {
  const grouped = new Map<
    string,
    {
      createdAt: Date
      alertCount: number
      totalDelta: number
      worstDelta: number
    }
  >()

  for (const event of events.slice(0, limit)) {
    const existing = grouped.get(event.auditId)

    if (!existing) {
      grouped.set(event.auditId, {
        createdAt: event.createdAt,
        alertCount: 1,
        totalDelta: event.delta,
        worstDelta: event.delta,
      })
      continue
    }

    existing.alertCount += 1
    existing.totalDelta += event.delta
    existing.worstDelta = Math.min(existing.worstDelta, event.delta)
    if (event.createdAt < existing.createdAt) {
      existing.createdAt = event.createdAt
    }
  }

  return Array.from(grouped.values())
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
    .map((entry) => ({
      label: formatTrendLabel(entry.createdAt),
      createdAt: entry.createdAt.toISOString(),
      alertCount: entry.alertCount,
      totalDelta: entry.totalDelta,
      worstDelta: entry.worstDelta,
    }))
}

function formatTrendLabel(value: Date) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(value)
}
