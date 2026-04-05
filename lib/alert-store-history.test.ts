import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    scoreAlertRule: {
      findMany: vi.fn(),
    },
    scoreAlertEvent: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('./db', () => ({
  prisma: mocks.prisma,
}))

vi.mock('./audit-store', () => ({
  getAuditReport: vi.fn(),
  getAuditReportsByTargetUrl: vi.fn(),
}))

import { getAlertHistoryPageForTargetUrl } from './alert-store'

describe('getAlertHistoryPageForTargetUrl', () => {
  it('filters and paginates alert events', async () => {
    const now = new Date('2026-04-05T12:00:00Z')
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
        id: 'event_1',
        ruleId: 'rule_1',
        auditId: 'audit_3',
        previousAuditId: 'audit_2',
        targetUrl: 'https://example.com/',
        metricKey: 'performance',
        metricLabel: 'Performance',
        previousScore: 90,
        currentScore: 80,
        delta: -10,
        deliveryChannel: 'webhook',
        deliveryTarget: 'https://example.com/webhook',
        deliveryStatus: 'sent',
        deliveryError: null,
        deliveredAt: now,
        createdAt: new Date('2026-04-05T12:05:00Z'),
        userId: null,
      },
      {
        id: 'event_2',
        ruleId: 'rule_1',
        auditId: 'audit_2',
        previousAuditId: 'audit_1',
        targetUrl: 'https://example.com/',
        metricKey: 'seo',
        metricLabel: 'SEO',
        previousScore: 94,
        currentScore: 88,
        delta: -6,
        deliveryChannel: 'webhook',
        deliveryTarget: 'https://example.com/webhook',
        deliveryStatus: 'failed',
        deliveryError: 'Webhook responded with 500.',
        deliveredAt: null,
        createdAt: new Date('2026-04-05T12:04:00Z'),
        userId: null,
      },
    ])

    const page = await getAlertHistoryPageForTargetUrl('https://example.com/', null, {
      metric: 'performance',
      status: 'sent',
      page: 1,
      pageSize: 10,
    })

    expect(page.total).toBe(1)
    expect(page.events).toHaveLength(1)
    expect(page.events[0]?.metricKey).toBe('performance')
    expect(page.totalPages).toBe(1)
  })
})
