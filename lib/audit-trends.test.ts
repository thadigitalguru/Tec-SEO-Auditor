import { describe, expect, it } from 'vitest'

import { buildAlertTrendSeries, buildAuditTrendSeries } from './audit-trends'
import type { ScoreAlertEvent } from './alert-store'
import type { StoredAudit } from './audit-store'

const audits: StoredAudit[] = [
  {
    id: 'audit_1',
    summary: 'First',
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
          performance: 72,
          accessibility: 80,
          bestPractices: 88,
          seo: 90,
        },
        metrics: {
          lcp: 2400,
          cls: 0,
          inp: 180,
          tbt: 120,
        },
        opportunities: [],
      },
      summary: {
        source: 'heuristic',
        headline: 'First',
        summary: 'First',
        priorities: [],
      },
      generatedAt: '2026-04-03T12:00:00Z',
    },
    createdAt: new Date('2026-04-03T12:00:00Z'),
    userId: null,
  },
  {
    id: 'audit_2',
    summary: 'Second',
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
          accessibility: 84,
          bestPractices: 89,
          seo: 92,
        },
        metrics: {
          lcp: 2100,
          cls: 0,
          inp: 160,
          tbt: 100,
        },
        opportunities: [],
      },
      summary: {
        source: 'heuristic',
        headline: 'Second',
        summary: 'Second',
        priorities: [],
      },
      generatedAt: '2026-04-04T12:00:00Z',
    },
    createdAt: new Date('2026-04-04T12:00:00Z'),
    userId: null,
  },
]

const events: ScoreAlertEvent[] = [
  {
    id: 'event_1',
    ruleId: 'rule_1',
    auditId: 'audit_2',
    previousAuditId: 'audit_1',
    targetUrl: 'https://example.com/',
    metricKey: 'performance',
    metricLabel: 'Performance',
    previousScore: 80,
    currentScore: 72,
    delta: -8,
    deliveryChannel: 'webhook',
    deliveryTarget: 'https://example.com/webhook',
    deliveryStatus: 'sent',
    deliveryError: null,
    deliveredAt: new Date('2026-04-04T12:05:10Z'),
    createdAt: new Date('2026-04-04T12:05:00Z'),
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
    previousScore: 92,
    currentScore: 88,
    delta: -4,
    deliveryChannel: 'webhook',
    deliveryTarget: 'https://example.com/webhook',
    deliveryStatus: 'sent',
    deliveryError: null,
    deliveredAt: new Date('2026-04-04T12:05:10Z'),
    createdAt: new Date('2026-04-04T12:05:00Z'),
    userId: null,
  },
]

describe('audit trend helpers', () => {
  it('builds score trend points in chronological order', () => {
    const trend = buildAuditTrendSeries(audits)

    expect(trend).toHaveLength(2)
    expect(trend[0]?.performance).toBe(72)
    expect(trend[1]?.performance).toBe(80)
  })

  it('groups alert events by audit and totals the score drop', () => {
    const trend = buildAlertTrendSeries(events)

    expect(trend).toHaveLength(1)
    expect(trend[0]).toMatchObject({
      alertCount: 2,
      totalDelta: -12,
      worstDelta: -8,
    })
  })
})
