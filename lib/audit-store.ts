import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { Prisma } from '@/app/generated/prisma/client'

import type { AuditReport } from './audit-engine'
import { prisma } from './db'

export interface StoredAudit {
  id: string
  summary: string | null
  results: AuditReport
  createdAt: Date
  userId: string | null
}

export interface RecentAudit {
  id: string
  summary: string | null
  targetUrl: string
  createdAt: Date
  userId: string | null
}

export interface AuditHistoryQuery {
  search?: string
  order?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export interface AuditHistoryResult {
  audits: RecentAudit[]
  search: string
  order: 'asc' | 'desc'
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

const localStorePath = path.join(os.tmpdir(), 'tec-seo-auditor-audits.json')

export async function saveAuditReport(report: AuditReport, userId: string | null): Promise<StoredAudit> {
  const record = {
    results: report as unknown as Prisma.InputJsonValue,
    summary: report.summary.summary,
    userId,
  } satisfies Prisma.AuditCreateInput

  try {
    const saved = await prisma.audit.create({
      data: record,
    })

    const normalizedSaved: StoredAudit = {
      id: saved.id,
      summary: saved.summary,
      results: saved.results as unknown as AuditReport,
      createdAt: saved.createdAt,
      userId: saved.userId,
    }

    await saveLocalAudit(normalizedSaved)

    return normalizedSaved
  } catch {
    const fallback = {
      id: cryptoRandomId(),
      summary: record.summary,
      results: report,
      createdAt: new Date(),
      userId,
    }

    await saveLocalAudit(fallback)
    return fallback
  }
}

export async function getAuditReport(id: string): Promise<StoredAudit | null> {
  try {
    const audit = await prisma.audit.findUnique({
      where: { id },
    })

    if (audit) {
      return {
        id: audit.id,
        summary: audit.summary,
        results: audit.results as unknown as AuditReport,
        createdAt: audit.createdAt,
        userId: audit.userId,
      }
    }
  } catch {
    // Fall through to local store.
  }

  const localAudit = await readLocalAudit(id)
  return localAudit ? normalizeLocalAudit(localAudit) : null
}

export async function getAuditReportsByTargetUrl(
  targetUrl: string,
  userId: string | null = null,
  limit = 2,
): Promise<StoredAudit[]> {
  const normalizedTargetUrl = targetUrl.trim()

  try {
    const audits = await prisma.audit.findMany({
      orderBy: { createdAt: 'desc' },
    })

    const matched = audits
      .filter((audit) => extractTargetUrl(audit.results) === normalizedTargetUrl)
      .filter((audit) => audit.userId === userId)
      .slice(0, limit)
      .map((audit) => ({
        id: audit.id,
        summary: audit.summary,
        results: audit.results as unknown as AuditReport,
        createdAt: audit.createdAt,
        userId: audit.userId,
      }))

    if (matched.length > 0) {
      return matched
    }
  } catch {
    // Fall through to local store.
  }

  return (await readLocalAudits())
    .map((audit) => normalizeLocalAudit(audit))
    .filter((audit) => audit.results.targetUrl === normalizedTargetUrl)
    .filter((audit) => audit.userId === userId)
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, limit)
}

export async function getRecentAudits(limit = 10): Promise<RecentAudit[]> {
  const result = await getAuditHistory({ page: 1, pageSize: limit })
  return result.audits
}

export async function getAuditHistory(
  query: AuditHistoryQuery = {},
): Promise<AuditHistoryResult> {
  const order = query.order === 'asc' ? 'asc' : 'desc'
  const search = normalizeSearch(query.search)
  const pageSize = clampInt(query.pageSize, 1, 50, 12)

  const audits = await readAllAudits(order)
  const filteredAudits = applyAuditHistoryQuery(audits, {
    search,
    order,
    page: query.page,
    pageSize,
  })

  return filteredAudits
}

export function applyAuditHistoryQuery(
  audits: RecentAudit[],
  query: AuditHistoryQuery = {},
): AuditHistoryResult {
  const order = query.order === 'asc' ? 'asc' : 'desc'
  const search = normalizeSearch(query.search)
  const pageSize = clampInt(query.pageSize, 1, 50, 12)

  const filtered = audits
    .filter((audit) => matchesSearch(audit, search))
    .sort((left, right) => {
      const comparison = left.createdAt.getTime() - right.createdAt.getTime()
      return order === 'asc' ? comparison : -comparison
    })

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const page = clampInt(query.page, 1, totalPages, 1)
  const startIndex = (page - 1) * pageSize

  return {
    audits: filtered.slice(startIndex, startIndex + pageSize),
    search,
    order,
    page,
    pageSize,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  }
}

async function saveLocalAudit(audit: StoredAudit) {
  const audits = await readLocalAudits()
  const nextAudits = [
    ...audits.filter((entry) => entry.id !== audit.id),
    serializeLocalAudit(audit),
  ]

  await fs.writeFile(localStorePath, JSON.stringify(nextAudits, null, 2), 'utf8')
}

async function readLocalAudit(id: string) {
  const audits = await readLocalAudits()
  return audits.find((entry) => entry.id === id) ?? null
}

async function readLocalAudits(): Promise<SerializedStoredAudit[]> {
  try {
    const raw = await fs.readFile(localStorePath, 'utf8')
    const parsed = JSON.parse(raw) as SerializedStoredAudit[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function readAllAudits(order: 'asc' | 'desc'): Promise<RecentAudit[]> {
  try {
    const audits = await prisma.audit.findMany({
      orderBy: { createdAt: order },
    })

    return audits.map((audit) => ({
      id: audit.id,
      summary: audit.summary,
      targetUrl: extractTargetUrl(audit.results),
      createdAt: audit.createdAt,
      userId: audit.userId,
    }))
  } catch {
    // Fall through to local store.
  }

  const localAudits = await readLocalAudits()
  return localAudits
    .map((audit) => normalizeLocalAudit(audit))
    .sort((left, right) => {
      const comparison = left.createdAt.getTime() - right.createdAt.getTime()
      return order === 'asc' ? comparison : -comparison
    })
    .map((audit) => ({
      id: audit.id,
      summary: audit.summary,
      targetUrl: audit.results.targetUrl,
      createdAt: audit.createdAt,
      userId: audit.userId,
    }))
}

function serializeLocalAudit(audit: StoredAudit): SerializedStoredAudit {
  return {
    ...audit,
    createdAt: audit.createdAt.toISOString(),
  }
}

function normalizeLocalAudit(audit: SerializedStoredAudit): StoredAudit {
  return {
    ...audit,
    createdAt: new Date(audit.createdAt),
  }
}

function extractTargetUrl(results: unknown): string {
  if (!results || typeof results !== 'object' || !('targetUrl' in results)) {
    return ''
  }

  const value = (results as { targetUrl?: unknown }).targetUrl
  return typeof value === 'string' ? value : ''
}

function matchesSearch(audit: RecentAudit, search: string) {
  if (!search) {
    return true
  }

  const haystacks = [audit.targetUrl, audit.summary ?? '']
    .map((value) => value.toLowerCase())

  return haystacks.some((value) => value.includes(search))
}

function normalizeSearch(value: string | undefined) {
  return (value ?? '').trim().toLowerCase()
}

function clampInt(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number,
) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue)) {
    return fallback
  }

  return Math.min(max, Math.max(min, Math.trunc(numericValue)))
}

function cryptoRandomId() {
  return `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

interface SerializedStoredAudit extends Omit<StoredAudit, 'createdAt'> {
  createdAt: string
}
