import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { Prisma } from '@/app/generated/prisma/client'

import type { AuditReport } from './audit-engine'
import { prisma } from './db'

export interface ScheduledAudit {
  id: string
  targetUrl: string
  cadenceDays: number
  nextRunAt: Date
  lastRunAt: Date | null
  lastAuditId: string | null
  active: boolean
  createdAt: Date
  updatedAt: Date
  userId: string | null
}

export interface ScheduledAuditSummary {
  id: string
  targetUrl: string
  cadenceDays: number
  nextRunAt: Date
  lastRunAt: Date | null
  active: boolean
}

export interface ScheduledAuditRun {
  id: string
  scheduleId: string
  targetUrl: string
  auditId: string | null
  status: 'success' | 'failed'
  error: string | null
  runAt: Date
  userId: string | null
}

export interface SaveScheduledAuditInput {
  auditId?: string
  targetUrl?: string
  cadenceDays: number
  startImmediately?: boolean
  userId?: string | null
}

const localStorePath = path.join(os.tmpdir(), 'tec-seo-auditor-schedules.json')
const localRunStorePath = path.join(os.tmpdir(), 'tec-seo-auditor-schedule-runs.json')

export async function saveScheduledAudit(
  input: SaveScheduledAuditInput,
): Promise<ScheduledAudit> {
  const targetUrl = await resolveTargetUrl(input)
  const cadenceDays = clampInt(input.cadenceDays, 1, 365, 7)
  const now = new Date()
  const nextRunAt = input.startImmediately ? now : addDays(now, cadenceDays)
  const record = {
    targetUrl,
    cadenceDays,
    nextRunAt,
    active: true,
    userId: input.userId ?? null,
  }

  try {
    const existing = await prisma.scheduledAudit.findFirst({
      where: {
        targetUrl,
        userId: input.userId ?? null,
      },
    })

    const saved = existing
      ? await prisma.scheduledAudit.update({
          where: { id: existing.id },
          data: record,
        })
      : await prisma.scheduledAudit.create({
          data: record satisfies Prisma.ScheduledAuditCreateInput,
        })

    const normalized = normalizeScheduledAudit(saved)
    await saveLocalSchedule(normalized)
    return normalized
  } catch {
    const fallback: ScheduledAudit = {
      id: cryptoRandomId(),
      targetUrl,
      cadenceDays,
      nextRunAt,
      lastRunAt: null,
      lastAuditId: null,
      active: true,
      createdAt: now,
      updatedAt: now,
      userId: input.userId ?? null,
    }

    await saveLocalSchedule(fallback)
    return fallback
  }
}

export async function getScheduledAudits(userId: string | null = null): Promise<ScheduledAuditSummary[]> {
  try {
    const schedules = await prisma.scheduledAudit.findMany({
      where: { userId },
      orderBy: { nextRunAt: 'asc' },
    })

    if (schedules.length > 0) {
      return schedules.map((schedule) => ({
        id: schedule.id,
        targetUrl: schedule.targetUrl,
        cadenceDays: schedule.cadenceDays,
        nextRunAt: schedule.nextRunAt,
        lastRunAt: schedule.lastRunAt,
        active: schedule.active,
      }))
    }
  } catch {
    // Fall through to local store.
  }

  return (await readLocalSchedules())
    .filter((schedule) => schedule.userId === userId)
    .sort((left, right) => left.nextRunAt.getTime() - right.nextRunAt.getTime())
    .map((schedule) => ({
      id: schedule.id,
      targetUrl: schedule.targetUrl,
      cadenceDays: schedule.cadenceDays,
      nextRunAt: schedule.nextRunAt,
      lastRunAt: schedule.lastRunAt,
      active: schedule.active,
    }))
}

export async function getScheduledAuditsForTargetUrl(
  targetUrl: string,
  userId: string | null = null,
): Promise<ScheduledAuditSummary[]> {
  const schedules = await getScheduledAudits(userId)
  return schedules.filter((schedule) => schedule.targetUrl === targetUrl)
}

export async function getDueScheduledAudits(now = new Date(), userId: string | null = null) {
  const schedules = await getScheduledAudits(userId)
  return schedules.filter((schedule) => schedule.active && schedule.nextRunAt <= now)
}

export async function updateScheduledAuditRun(
  id: string,
  auditId: string,
  nextRunAt: Date,
  userId: string | null = null,
) {
  try {
    const updated = await prisma.scheduledAudit.update({
      where: { id },
      data: {
        lastRunAt: new Date(),
        lastAuditId: auditId,
        nextRunAt,
      },
    })

    const normalized = normalizeScheduledAudit(updated)
    await saveLocalSchedule(normalized)
    return normalized
  } catch {
    const schedules = await readLocalSchedules()
    const nextSchedules = schedules.map((schedule) => {
      if (schedule.id !== id || schedule.userId !== userId) {
        return schedule
      }

      return {
        ...schedule,
        lastRunAt: new Date(),
        lastAuditId: auditId,
        nextRunAt,
        updatedAt: new Date(),
      }
    })

    await writeLocalSchedules(nextSchedules)
    return nextSchedules.find((schedule) => schedule.id === id && schedule.userId === userId) ?? null
  }
}

export async function setScheduledAuditActive(
  id: string,
  active: boolean,
  userId: string | null = null,
) {
  try {
    const updated = await prisma.scheduledAudit.update({
      where: { id },
      data: { active },
    })

    const normalized = normalizeScheduledAudit(updated)
    await saveLocalSchedule(normalized)
    return normalized
  } catch {
    const schedules = await readLocalSchedules()
    const nextSchedules = schedules.map((schedule) =>
      schedule.id === id && schedule.userId === userId
        ? { ...schedule, active, updatedAt: new Date() }
        : schedule,
    )

    await writeLocalSchedules(nextSchedules)
    return nextSchedules.find((schedule) => schedule.id === id && schedule.userId === userId) ?? null
  }
}

export async function recordScheduledAuditRun(run: {
  scheduleId: string
  targetUrl: string
  auditId: string | null
  status: 'success' | 'failed'
  error?: string | null
  userId?: string | null
}) {
  const now = new Date()
  const record: ScheduledAuditRun = {
    id: cryptoRandomId(),
    scheduleId: run.scheduleId,
    targetUrl: run.targetUrl,
    auditId: run.auditId,
    status: run.status,
    error: run.error ?? null,
    runAt: now,
    userId: run.userId ?? null,
  }

  try {
    await prisma.scheduledAuditRun.create({
      data: {
        id: record.id,
        scheduleId: record.scheduleId,
        targetUrl: record.targetUrl,
        auditId: record.auditId,
        status: record.status,
        error: record.error,
        runAt: record.runAt,
        userId: record.userId,
      },
    })
    await saveLocalRun(record)
    return record
  } catch {
    await saveLocalRun(record)
    return record
  }
}

export async function getScheduledAuditRunsForTargetUrl(
  targetUrl: string,
  userId: string | null = null,
  limit = 20,
): Promise<ScheduledAuditRun[]> {
  try {
    const runs = await prisma.scheduledAuditRun.findMany({
      where: { targetUrl, userId },
      orderBy: { runAt: 'desc' },
      take: limit,
    })

    if (runs.length > 0) {
      return runs.map(normalizeScheduledAuditRun)
    }
  } catch {
    // Fall through to local store.
  }

  return (await readLocalRuns())
    .filter((run) => run.targetUrl === targetUrl)
    .filter((run) => run.userId === userId)
    .sort((left, right) => right.runAt.getTime() - left.runAt.getTime())
    .slice(0, limit)
}

export async function getScheduledAuditRunsForScheduleId(
  scheduleId: string,
  userId: string | null = null,
  limit = 10,
): Promise<ScheduledAuditRun[]> {
  try {
    const runs = await prisma.scheduledAuditRun.findMany({
      where: { scheduleId, userId },
      orderBy: { runAt: 'desc' },
      take: limit,
    })

    if (runs.length > 0) {
      return runs.map(normalizeScheduledAuditRun)
    }
  } catch {
    // Fall through to local store.
  }

  return (await readLocalRuns())
    .filter((run) => run.scheduleId === scheduleId)
    .filter((run) => run.userId === userId)
    .sort((left, right) => right.runAt.getTime() - left.runAt.getTime())
    .slice(0, limit)
}

async function resolveTargetUrl(input: SaveScheduledAuditInput) {
  if (input.targetUrl) {
    return normalizeTargetUrl(input.targetUrl)
  }

  if (input.auditId) {
    const audit = await prisma.audit.findUnique({ where: { id: input.auditId } })
    if (audit) {
      const report = audit.results as unknown as AuditReport
      return normalizeTargetUrl(report.targetUrl)
    }
  }

  throw new Error('A saved audit URL is required.')
}

async function saveLocalSchedule(schedule: ScheduledAudit) {
  const schedules = await readLocalSchedules()
  const nextSchedules = [
    ...schedules.filter((entry) => entry.id !== schedule.id),
    schedule,
  ]

  await writeLocalSchedules(nextSchedules)
}

async function readLocalSchedules(): Promise<ScheduledAudit[]> {
  try {
    const raw = await fs.readFile(localStorePath, 'utf8')
    const parsed = JSON.parse(raw) as SerializedScheduledAudit[]
    return Array.isArray(parsed) ? parsed.map(normalizeLocalSchedule) : []
  } catch {
    return []
  }
}

async function writeLocalSchedules(schedules: ScheduledAudit[]) {
  const serialized = schedules.map(serializeLocalSchedule)
  await fs.writeFile(localStorePath, JSON.stringify(serialized, null, 2), 'utf8')
}

async function saveLocalRun(run: ScheduledAuditRun) {
  const runs = await readLocalRuns()
  const nextRuns = [...runs.filter((entry) => entry.id !== run.id), run]
  await fs.writeFile(localRunStorePath, JSON.stringify(nextRuns, null, 2), 'utf8')
}

async function readLocalRuns(): Promise<ScheduledAuditRun[]> {
  try {
    const raw = await fs.readFile(localRunStorePath, 'utf8')
    const parsed = JSON.parse(raw) as SerializedScheduledAuditRun[]
    return Array.isArray(parsed) ? parsed.map(normalizeLocalRun) : []
  } catch {
    return []
  }
}

function normalizeScheduledAudit(schedule: {
  id: string
  targetUrl: string
  cadenceDays: number
  nextRunAt: Date
  lastRunAt: Date | null
  lastAuditId: string | null
  active: boolean
  createdAt: Date
  updatedAt: Date
  userId: string | null
}): ScheduledAudit {
  return {
    ...schedule,
  }
}

function serializeLocalSchedule(schedule: ScheduledAudit): SerializedScheduledAudit {
  return {
    ...schedule,
    nextRunAt: schedule.nextRunAt.toISOString(),
    lastRunAt: schedule.lastRunAt ? schedule.lastRunAt.toISOString() : null,
    createdAt: schedule.createdAt.toISOString(),
    updatedAt: schedule.updatedAt.toISOString(),
  }
}

function normalizeLocalSchedule(schedule: SerializedScheduledAudit): ScheduledAudit {
  return {
    ...schedule,
    nextRunAt: new Date(schedule.nextRunAt),
    lastRunAt: schedule.lastRunAt ? new Date(schedule.lastRunAt) : null,
    createdAt: new Date(schedule.createdAt),
    updatedAt: new Date(schedule.updatedAt),
  }
}

function normalizeScheduledAuditRun(run: {
  id: string
  scheduleId: string
  targetUrl: string
  auditId: string | null
  status: string
  error: string | null
  runAt: Date
  userId: string | null
}): ScheduledAuditRun {
  return {
    ...run,
    status: run.status === 'failed' ? 'failed' : 'success',
    error: run.error ?? null,
  }
}

function normalizeLocalRun(run: SerializedScheduledAuditRun): ScheduledAuditRun {
  return {
    ...run,
    status: run.status === 'failed' ? 'failed' : 'success',
    error: run.error ?? null,
    runAt: new Date(run.runAt),
  }
}

function normalizeTargetUrl(value: string) {
  const targetUrl = new URL(value)
  if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
    throw new Error(`Unsupported URL protocol: ${targetUrl.protocol}`)
  }

  return targetUrl.href
}

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000)
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

function cryptoRandomId() {
  return `schedule_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

interface SerializedScheduledAudit extends Omit<ScheduledAudit, 'nextRunAt' | 'lastRunAt' | 'createdAt' | 'updatedAt'> {
  nextRunAt: string
  lastRunAt: string | null
  createdAt: string
  updatedAt: string
}

interface SerializedScheduledAuditRun extends Omit<ScheduledAuditRun, 'runAt'> {
  runAt: string
}
