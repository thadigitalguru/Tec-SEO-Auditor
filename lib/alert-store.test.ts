import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  prisma: {
    scoreAlertRule: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    scoreAlertEvent: {
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
  },
  getAuditReport: vi.fn(),
  getAuditReportsByTargetUrl: vi.fn(),
}))

vi.mock('node:fs/promises', () => ({
  default: {
    readFile: mocks.readFile,
    writeFile: mocks.writeFile,
  },
  readFile: mocks.readFile,
  writeFile: mocks.writeFile,
}))

vi.mock('./db', () => ({
  prisma: mocks.prisma,
}))

vi.mock('./audit-store', () => ({
  getAuditReport: mocks.getAuditReport,
  getAuditReportsByTargetUrl: mocks.getAuditReportsByTargetUrl,
}))

vi.stubGlobal('fetch', vi.fn(async () => ({
  ok: true,
  status: 200,
  json: async () => ({}),
  text: async () => '',
})))

import { recordScoreDropAlerts } from './alert-store'

describe('recordScoreDropAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('records an alert when a score drops beyond the configured threshold', async () => {
    const now = new Date('2026-04-05T12:00:00Z')
    mocks.readFile.mockRejectedValueOnce(new Error('ENOENT'))
    mocks.writeFile.mockResolvedValue(undefined)
    mocks.prisma.scoreAlertRule.findMany.mockResolvedValue([
      {
        id: 'rule_1',
        targetUrl: 'https://example.com/',
        dropPoints: 5,
        active: true,
        deliveryChannel: 'webhook',
        deliveryTarget: 'https://example.com/webhook',
        createdAt: now,
        updatedAt: now,
        userId: null,
      },
    ])
    mocks.prisma.scoreAlertEvent.createMany.mockResolvedValue({ count: 1 })
    mocks.getAuditReportsByTargetUrl.mockResolvedValue([
      {
        id: 'audit_current',
        summary: 'Current',
        results: {
          targetUrl: 'https://example.com/',
          crawl: {
            startUrl: 'https://example.com/',
            sitemapUrls: [],
            discoveredUrls: [],
            pages: [],
          },
          lighthouse: {
            url: 'https://example.com/',
            scores: {
              performance: 80,
              accessibility: 90,
              bestPractices: 92,
              seo: 94,
            },
            metrics: {
              lcp: 1200,
              cls: 0,
              inp: 120,
              tbt: 80,
            },
            opportunities: [],
          },
          summary: {
            source: 'heuristic',
            headline: 'Current',
            summary: 'Current',
            priorities: [],
          },
          generatedAt: now.toISOString(),
        },
        createdAt: now,
        userId: null,
      },
      {
        id: 'audit_previous',
        summary: 'Previous',
        results: {
          targetUrl: 'https://example.com/',
          crawl: {
            startUrl: 'https://example.com/',
            sitemapUrls: [],
            discoveredUrls: [],
            pages: [],
          },
          lighthouse: {
            url: 'https://example.com/',
            scores: {
              performance: 92,
              accessibility: 90,
              bestPractices: 92,
              seo: 94,
            },
            metrics: {
              lcp: 900,
              cls: 0,
              inp: 110,
              tbt: 60,
            },
            opportunities: [],
          },
          summary: {
            source: 'heuristic',
            headline: 'Previous',
            summary: 'Previous',
            priorities: [],
          },
          generatedAt: now.toISOString(),
        },
        createdAt: new Date('2026-04-04T12:00:00Z'),
        userId: null,
      },
    ])

    const events = await recordScoreDropAlerts(
      {
        id: 'audit_current',
        summary: 'Current',
        results: {
          targetUrl: 'https://example.com/',
          crawl: {
            startUrl: 'https://example.com/',
            sitemapUrls: [],
            discoveredUrls: [],
            pages: [],
          },
          lighthouse: {
            url: 'https://example.com/',
            scores: {
              performance: 80,
              accessibility: 90,
              bestPractices: 92,
              seo: 94,
            },
            metrics: {
              lcp: 1200,
              cls: 0,
              inp: 120,
              tbt: 80,
            },
            opportunities: [],
          },
          summary: {
            source: 'heuristic',
            headline: 'Current',
            summary: 'Current',
            priorities: [],
          },
          generatedAt: now.toISOString(),
        },
        createdAt: now,
        userId: null,
      },
      null,
    )

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      ruleId: 'rule_1',
      auditId: 'audit_current',
      previousAuditId: 'audit_previous',
      metricKey: 'performance',
      metricLabel: 'Performance',
      previousScore: 92,
      currentScore: 80,
      delta: -12,
      userId: null,
    })
    expect(mocks.prisma.scoreAlertEvent.createMany).toHaveBeenCalledTimes(1)
    expect(mocks.writeFile).toHaveBeenCalled()
  })

  it('skips recording when drops stay below the configured threshold', async () => {
    const now = new Date('2026-04-05T12:00:00Z')
    mocks.readFile.mockRejectedValueOnce(new Error('ENOENT'))
    mocks.writeFile.mockResolvedValue(undefined)
    mocks.prisma.scoreAlertRule.findMany.mockResolvedValue([
      {
        id: 'rule_1',
        targetUrl: 'https://example.com/',
        dropPoints: 15,
        active: true,
        deliveryChannel: 'webhook',
        deliveryTarget: 'https://example.com/webhook',
        createdAt: now,
        updatedAt: now,
        userId: null,
      },
    ])
    mocks.getAuditReportsByTargetUrl.mockResolvedValue([
      {
        id: 'audit_current',
        summary: 'Current',
        results: {
          targetUrl: 'https://example.com/',
          crawl: {
            startUrl: 'https://example.com/',
            sitemapUrls: [],
            discoveredUrls: [],
            pages: [],
          },
          lighthouse: {
            url: 'https://example.com/',
            scores: {
              performance: 86,
              accessibility: 90,
              bestPractices: 92,
              seo: 94,
            },
            metrics: {
              lcp: 1200,
              cls: 0,
              inp: 120,
              tbt: 80,
            },
            opportunities: [],
          },
          summary: {
            source: 'heuristic',
            headline: 'Current',
            summary: 'Current',
            priorities: [],
          },
          generatedAt: now.toISOString(),
        },
        createdAt: now,
        userId: null,
      },
      {
        id: 'audit_previous',
        summary: 'Previous',
        results: {
          targetUrl: 'https://example.com/',
          crawl: {
            startUrl: 'https://example.com/',
            sitemapUrls: [],
            discoveredUrls: [],
            pages: [],
          },
          lighthouse: {
            url: 'https://example.com/',
            scores: {
              performance: 92,
              accessibility: 90,
              bestPractices: 92,
              seo: 94,
            },
            metrics: {
              lcp: 900,
              cls: 0,
              inp: 110,
              tbt: 60,
            },
            opportunities: [],
          },
          summary: {
            source: 'heuristic',
            headline: 'Previous',
            summary: 'Previous',
            priorities: [],
          },
          generatedAt: now.toISOString(),
        },
        createdAt: new Date('2026-04-04T12:00:00Z'),
        userId: null,
      },
    ])

    const events = await recordScoreDropAlerts(
      {
        id: 'audit_current',
        summary: 'Current',
        results: {
          targetUrl: 'https://example.com/',
          crawl: {
            startUrl: 'https://example.com/',
            sitemapUrls: [],
            discoveredUrls: [],
            pages: [],
          },
          lighthouse: {
            url: 'https://example.com/',
            scores: {
              performance: 86,
              accessibility: 90,
              bestPractices: 92,
              seo: 94,
            },
            metrics: {
              lcp: 1200,
              cls: 0,
              inp: 120,
              tbt: 80,
            },
            opportunities: [],
          },
          summary: {
            source: 'heuristic',
            headline: 'Current',
            summary: 'Current',
            priorities: [],
          },
          generatedAt: now.toISOString(),
        },
        createdAt: now,
        userId: null,
      },
      null,
    )

    expect(events).toHaveLength(0)
    expect(mocks.prisma.scoreAlertEvent.createMany).not.toHaveBeenCalled()
  })

  it('deduplicates the same metric inside the cooldown window', async () => {
    const now = new Date('2026-04-05T12:00:00Z')
    mocks.readFile.mockRejectedValueOnce(new Error('ENOENT'))
    mocks.writeFile.mockResolvedValue(undefined)
    mocks.prisma.scoreAlertRule.findMany.mockResolvedValue([
      {
        id: 'rule_1',
        targetUrl: 'https://example.com/',
        dropPoints: 5,
        active: true,
        deliveryChannel: 'webhook',
        deliveryTarget: 'https://example.com/webhook',
        cooldownHours: 24,
        createdAt: now,
        updatedAt: now,
        userId: null,
      },
    ])
    mocks.prisma.scoreAlertEvent.findMany.mockResolvedValue([
      {
        id: 'event_previous',
        ruleId: 'rule_1',
        auditId: 'audit_previous',
        previousAuditId: null,
        targetUrl: 'https://example.com/',
        metricKey: 'performance',
        metricLabel: 'Performance',
        previousScore: 94,
        currentScore: 88,
        delta: -6,
        deliveryChannel: 'webhook',
        deliveryTarget: 'https://example.com/webhook',
        deliveryStatus: 'sent',
        deliveryError: null,
        deliveredAt: new Date('2026-04-05T11:00:00Z'),
        createdAt: new Date('2026-04-05T11:00:00Z'),
        userId: null,
      },
    ])
    mocks.getAuditReportsByTargetUrl.mockResolvedValue([
      {
        id: 'audit_current',
        summary: 'Current',
        results: {
          targetUrl: 'https://example.com/',
          crawl: {
            startUrl: 'https://example.com/',
            sitemapUrls: [],
            discoveredUrls: [],
            pages: [],
          },
          lighthouse: {
            url: 'https://example.com/',
            scores: {
              performance: 80,
              accessibility: 90,
              bestPractices: 92,
              seo: 94,
            },
            metrics: {
              lcp: 1200,
              cls: 0,
              inp: 120,
              tbt: 80,
            },
            opportunities: [],
          },
          summary: {
            source: 'heuristic',
            headline: 'Current',
            summary: 'Current',
            priorities: [],
          },
          generatedAt: now.toISOString(),
        },
        createdAt: now,
        userId: null,
      },
      {
        id: 'audit_previous',
        summary: 'Previous',
        results: {
          targetUrl: 'https://example.com/',
          crawl: {
            startUrl: 'https://example.com/',
            sitemapUrls: [],
            discoveredUrls: [],
            pages: [],
          },
          lighthouse: {
            url: 'https://example.com/',
            scores: {
              performance: 92,
              accessibility: 90,
              bestPractices: 92,
              seo: 94,
            },
            metrics: {
              lcp: 900,
              cls: 0,
              inp: 110,
              tbt: 60,
            },
            opportunities: [],
          },
          summary: {
            source: 'heuristic',
            headline: 'Previous',
            summary: 'Previous',
            priorities: [],
          },
          generatedAt: now.toISOString(),
        },
        createdAt: new Date('2026-04-04T12:00:00Z'),
        userId: null,
      },
    ])

    const events = await recordScoreDropAlerts(
      {
        id: 'audit_current',
        summary: 'Current',
        results: {
          targetUrl: 'https://example.com/',
          crawl: {
            startUrl: 'https://example.com/',
            sitemapUrls: [],
            discoveredUrls: [],
            pages: [],
          },
          lighthouse: {
            url: 'https://example.com/',
            scores: {
              performance: 80,
              accessibility: 90,
              bestPractices: 92,
              seo: 94,
            },
            metrics: {
              lcp: 1200,
              cls: 0,
              inp: 120,
              tbt: 80,
            },
            opportunities: [],
          },
          summary: {
            source: 'heuristic',
            headline: 'Current',
            summary: 'Current',
            priorities: [],
          },
          generatedAt: now.toISOString(),
        },
        createdAt: now,
        userId: null,
      },
      null,
    )

    expect(events).toHaveLength(0)
    expect(mocks.prisma.scoreAlertEvent.createMany).not.toHaveBeenCalled()
  })
})
