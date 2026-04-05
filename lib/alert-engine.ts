import type { StoredAudit } from './audit-store'
import {
  getAlertHistoryForTargetUrl,
  recordScoreDropAlerts,
  saveScoreAlertRule,
  type ScoreAlertEvent,
  type ScoreAlertRule,
  type ScoreMetricKey,
} from './alert-store'

export interface ScoreDropFinding {
  metricKey: ScoreMetricKey
  metricLabel: string
  previousScore: number
  currentScore: number
  delta: number
}

export async function ensureScoreAlertRule(
  targetUrl: string,
  dropPoints: number,
  userId: string | null = null,
  options: {
    active?: boolean
    deliveryChannel?: 'webhook' | 'email'
    deliveryTarget?: string | null
    cooldownHours?: number
  } = {},
) {
  return await saveScoreAlertRule({
    targetUrl,
    dropPoints,
    userId,
    active: options.active,
    deliveryChannel: options.deliveryChannel,
    deliveryTarget: options.deliveryTarget,
    cooldownHours: options.cooldownHours,
  })
}

export async function evaluateAuditScoreAlerts(
  audit: StoredAudit,
  userId: string | null = null,
): Promise<ScoreAlertEvent[]> {
  return await recordScoreDropAlerts(audit, userId)
}

export async function getAlertOverview(targetUrl: string, userId: string | null = null): Promise<{
  rule: ScoreAlertRule | null
  events: ScoreAlertEvent[]
  recentDrops: ScoreDropFinding[]
}> {
  const { rule, events } = await getAlertHistoryForTargetUrl(targetUrl, userId)
  const recentDrops = events.map((event) => ({
    metricKey: event.metricKey,
    metricLabel: event.metricLabel,
    previousScore: event.previousScore,
    currentScore: event.currentScore,
    delta: event.delta,
  }))

  return {
    rule,
    events,
    recentDrops,
  }
}

export { getAlertHistoryForTargetUrl }
