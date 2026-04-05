import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getAuditReport: vi.fn(),
  getAlertHistoryPageForTargetUrl: vi.fn(),
}))

vi.mock('@/lib/audit-store', () => ({
  getAuditReport: mocks.getAuditReport,
}))

vi.mock('@/lib/alert-store', () => ({
  getAlertHistoryPageForTargetUrl: mocks.getAlertHistoryPageForTargetUrl,
}))

import { GET } from './route'

describe('alert history export route', () => {
  it('returns json export by default', async () => {
    const now = new Date('2026-04-05T12:00:00Z')
    mocks.getAuditReport.mockResolvedValue({
      id: 'audit_1',
      summary: 'Summary',
      results: {
        targetUrl: 'https://example.com/',
      },
      createdAt: now,
      userId: null,
    })
    mocks.getAlertHistoryPageForTargetUrl.mockResolvedValue({
      rule: null,
      events: [
        {
          id: 'event_1',
          ruleId: 'rule_1',
          auditId: 'audit_1',
          previousAuditId: null,
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
          createdAt: now,
          userId: null,
        },
      ],
      page: 1,
      pageSize: 100,
      total: 1,
      totalPages: 1,
    })

    const response = await GET(new Request('http://localhost'), {
      params: Promise.resolve({ id: 'audit_1' }),
    })

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.events).toHaveLength(1)
  })

  it('returns csv export when requested', async () => {
    const now = new Date('2026-04-05T12:00:00Z')
    mocks.getAuditReport.mockResolvedValue({
      id: 'audit_1',
      summary: 'Summary',
      results: {
        targetUrl: 'https://example.com/',
      },
      createdAt: now,
      userId: null,
    })
    mocks.getAlertHistoryPageForTargetUrl.mockResolvedValue({
      rule: null,
      events: [],
      page: 1,
      pageSize: 100,
      total: 0,
      totalPages: 1,
    })

    const response = await GET(new Request('http://localhost?format=csv'), {
      params: Promise.resolve({ id: 'audit_1' }),
    })

    expect(response.headers.get('content-type')).toContain('text/csv')
    expect(await response.text()).toContain('metricKey')
  })
})
