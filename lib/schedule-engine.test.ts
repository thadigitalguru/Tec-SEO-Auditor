import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  return {
    saveAuditReport: vi.fn(),
    updateScheduledAuditRun: vi.fn(),
    evaluateAuditScoreAlerts: vi.fn(async () => []),
    recordScheduledAuditRun: vi.fn(async () => null),
  }
})

vi.mock('./audit-engine', () => ({
  auditSite: vi.fn(async (url: string) => ({
    targetUrl: url,
    crawl: {
      startUrl: url,
      sitemapUrls: [],
      discoveredUrls: [url],
      pages: [],
    },
    lighthouse: {
      url,
      scores: {
        performance: 90,
        accessibility: 95,
        bestPractices: 92,
        seo: 93,
      },
      metrics: {
        lcp: 1200,
        cls: 0,
        inp: 100,
        tbt: 60,
      },
      opportunities: [],
    },
    summary: {
      source: 'heuristic',
      headline: 'Headline',
      summary: 'Summary',
      priorities: [],
    },
    generatedAt: new Date().toISOString(),
  })),
}))

vi.mock('./audit-store', () => ({
  saveAuditReport: mocks.saveAuditReport,
}))

vi.mock('./alert-engine', () => ({
  evaluateAuditScoreAlerts: mocks.evaluateAuditScoreAlerts,
}))

vi.mock('./schedule-store', () => ({
  getDueScheduledAudits: vi.fn(async () => [
    {
      id: 'schedule_1',
      targetUrl: 'https://example.com/audit-target',
      cadenceDays: 7,
      nextRunAt: new Date('2026-04-05T12:00:00Z'),
      lastRunAt: null,
      active: true,
    },
  ]),
  getScheduledAudits: vi.fn(async () => []),
  getScheduledAuditRunsForScheduleId: vi.fn(async () => []),
  setScheduledAuditActive: vi.fn(async () => null),
  updateScheduledAuditRun: mocks.updateScheduledAuditRun,
  recordScheduledAuditRun: mocks.recordScheduledAuditRun,
}))

import { runDueScheduledAudits } from './schedule-engine'

describe('runDueScheduledAudits', () => {
  it('runs due schedules and advances next run date', async () => {
    mocks.saveAuditReport.mockResolvedValue({
      id: 'audit_saved',
      summary: 'Summary',
      results: {
        targetUrl: 'https://example.com/audit-target',
      },
      createdAt: new Date('2026-04-05T12:00:00Z'),
      userId: null,
    })

    const runs = await runDueScheduledAudits({
      now: new Date('2026-04-05T12:00:00Z'),
    })

    expect(runs).toHaveLength(1)
    expect(runs[0]).toMatchObject({
      scheduleId: 'schedule_1',
      targetUrl: 'https://example.com/audit-target',
      auditId: 'audit_saved',
      success: true,
    })
    expect(mocks.saveAuditReport).toHaveBeenCalledTimes(1)
    expect(mocks.evaluateAuditScoreAlerts).toHaveBeenCalledTimes(1)
    expect(mocks.recordScheduledAuditRun).toHaveBeenCalledTimes(1)
    expect(mocks.updateScheduledAuditRun).toHaveBeenCalledTimes(1)
  })
})
