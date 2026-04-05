import { evaluateAuditScoreAlerts } from './alert-engine'
import { auditSite, type AuditReport } from './audit-engine'
import { saveAuditReport } from './audit-store'
import {
  getDueScheduledAudits,
  getScheduledAudits,
  getScheduledAuditRunsForScheduleId,
  setScheduledAuditActive,
  recordScheduledAuditRun,
  updateScheduledAuditRun,
} from './schedule-store'

export interface ScheduledReauditResult {
  scheduleId: string
  targetUrl: string
  auditId: string | null
  nextRunAt: Date
  success: boolean
  error?: string
}

export interface RunScheduledAuditsOptions {
  now?: Date
  userId?: string | null
  limit?: number
}

export async function runDueScheduledAudits(
  options: RunScheduledAuditsOptions = {},
): Promise<ScheduledReauditResult[]> {
  const now = options.now ?? new Date()
  const userId = options.userId ?? null
  const limit = clampInt(options.limit ?? 20, 1, 100, 20)
  const dueSchedules = await getDueScheduledAudits(now, userId)
  const results: ScheduledReauditResult[] = []

  for (const schedule of dueSchedules.slice(0, limit)) {
    try {
      const report = await auditSite(schedule.targetUrl)
      const saved = await saveAuditReport(report, userId)
      await evaluateAuditScoreAlerts(saved, userId)
      await recordScheduledAuditRun({
        scheduleId: schedule.id,
        targetUrl: schedule.targetUrl,
        auditId: saved.id,
        status: 'success',
        userId,
      })
      const nextRunAt = new Date(now.getTime() + schedule.cadenceDays * 24 * 60 * 60 * 1000)
      await updateScheduledAuditRun(schedule.id, saved.id, nextRunAt, userId)

      results.push({
        scheduleId: schedule.id,
        targetUrl: schedule.targetUrl,
        auditId: saved.id,
        nextRunAt,
        success: true,
      })
    } catch (error) {
      await recordScheduledAuditRun({
        scheduleId: schedule.id,
        targetUrl: schedule.targetUrl,
        auditId: null,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unable to run scheduled audit.',
        userId,
      })
      results.push({
        scheduleId: schedule.id,
        targetUrl: schedule.targetUrl,
        auditId: null,
        nextRunAt: schedule.nextRunAt,
        success: false,
        error: error instanceof Error ? error.message : 'Unable to run scheduled audit.',
      })
    }
  }

  return results
}

export async function getScheduledAuditSummary(userId: string | null = null) {
  return await getScheduledAudits(userId)
}

export async function deactivateScheduledAudit(id: string, userId: string | null = null) {
  return await setScheduledAuditActive(id, false, userId)
}

export async function getScheduledAuditRunHistory(
  scheduleId: string,
  userId: string | null = null,
) {
  return await getScheduledAuditRunsForScheduleId(scheduleId, userId, 10)
}

export async function retryScheduledAudit(scheduleId: string, userId: string | null = null) {
  const schedules = await getScheduledAudits(userId)
  const schedule = schedules.find((entry) => entry.id === scheduleId)

  if (!schedule) {
    throw new Error('Schedule not found.')
  }

  const report = await auditSite(schedule.targetUrl)
  const saved = await saveAuditReport(report, userId)
  await evaluateAuditScoreAlerts(saved, userId)
  await recordScheduledAuditRun({
    scheduleId: schedule.id,
    targetUrl: schedule.targetUrl,
    auditId: saved.id,
    status: 'success',
    userId,
  })
  const nextRunAt = new Date(Date.now() + schedule.cadenceDays * 24 * 60 * 60 * 1000)
  await updateScheduledAuditRun(schedule.id, saved.id, nextRunAt, userId)

  return saved
}

function clampInt(
  value: number,
  min: number,
  max: number,
  fallback: number,
) {
  if (!Number.isFinite(value)) {
    return fallback
  }

  return Math.min(max, Math.max(min, Math.trunc(value)))
}

export type { AuditReport }
