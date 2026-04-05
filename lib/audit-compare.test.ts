import { describe, expect, it } from 'vitest'

import { buildAuditComparison, comparisonHeadline } from './audit-compare'
import type { StoredAudit } from './audit-store'

function makeAudit(overrides: Partial<StoredAudit>): StoredAudit {
  return {
    id: 'audit',
    summary: 'Summary',
    createdAt: new Date('2026-03-10T12:00:00Z'),
    userId: null,
    results: {
      targetUrl: 'https://example.com/',
      crawl: {
        startUrl: 'https://example.com/',
        sitemapUrls: [],
        discoveredUrls: ['https://example.com/'],
        pages: [],
      },
      lighthouse: {
        url: 'https://example.com/',
        scores: {
          performance: 80,
          accessibility: 90,
          bestPractices: 85,
          seo: 88,
        },
        metrics: {
          lcp: 1200,
          cls: 0.02,
          inp: 140,
          tbt: 60,
        },
        opportunities: [],
      },
      summary: {
        source: 'heuristic',
        headline: 'Headline',
        summary: 'Summary',
        priorities: [
          {
            title: 'Improve performance',
            impact: 'High',
            reason: 'Performance needs work.',
          },
          {
            title: 'Tighten SEO',
            impact: 'Medium',
            reason: 'SEO can improve.',
          },
        ],
      },
      generatedAt: '2026-03-10T12:00:00Z',
    },
    ...overrides,
  }
}

describe('buildAuditComparison', () => {
  it('builds score, metric, and priority deltas', () => {
    const comparison = buildAuditComparison(
      makeAudit({
        id: 'base',
        results: {
          targetUrl: 'https://example.com/base',
          crawl: {
            startUrl: 'https://example.com/base',
            sitemapUrls: [],
            discoveredUrls: ['https://example.com/base'],
            pages: [{ url: 'https://example.com/base', title: 'Base', status: 200, links: [] }],
          },
          lighthouse: {
            url: 'https://example.com/base',
            scores: {
              performance: 70,
              accessibility: 88,
              bestPractices: 84,
              seo: 79,
            },
            metrics: {
              lcp: 2400,
              cls: 0.1,
              inp: 180,
              tbt: 120,
            },
            opportunities: [],
          },
          summary: {
            source: 'heuristic',
            headline: 'Base',
            summary: 'Base summary',
            priorities: [
              {
                title: 'Improve performance',
                impact: 'High',
                reason: 'Performance needs work.',
              },
            ],
          },
          generatedAt: '2026-03-10T12:00:00Z',
        },
      }),
      makeAudit({
        id: 'comparison',
        results: {
          targetUrl: 'https://example.com/comparison',
          crawl: {
            startUrl: 'https://example.com/comparison',
            sitemapUrls: [],
            discoveredUrls: ['https://example.com/comparison', 'https://example.com/about'],
            pages: [
              { url: 'https://example.com/comparison', title: 'Comparison', status: 200, links: [] },
              { url: 'https://example.com/about', title: 'About', status: 200, links: [] },
            ],
          },
          lighthouse: {
            url: 'https://example.com/comparison',
            scores: {
              performance: 82,
              accessibility: 91,
              bestPractices: 89,
              seo: 86,
            },
            metrics: {
              lcp: 1800,
              cls: 0.04,
              inp: 150,
              tbt: 90,
            },
            opportunities: [],
          },
          summary: {
            source: 'heuristic',
            headline: 'Comparison',
            summary: 'Comparison summary',
            priorities: [
              {
                title: 'Improve performance',
                impact: 'High',
                reason: 'Performance needs work.',
              },
              {
                title: 'Reduce unused JavaScript',
                impact: 'Medium',
                reason: 'Bundle weight still matters.',
              },
            ],
          },
          generatedAt: '2026-03-11T12:00:00Z',
        },
      }),
    )

    expect(comparison.scoreComparisons[0]).toMatchObject({
      label: 'Performance',
      base: 70,
      comparison: 82,
      delta: 12,
    })
    expect(comparison.metricComparisons[0]).toMatchObject({
      label: 'LCP',
      base: 2400,
      comparison: 1800,
      delta: -600,
    })
    expect(comparison.sharedPriorities).toEqual(['Improve performance'])
    expect(comparison.baseOnlyPriorities).toEqual([])
    expect(comparison.comparisonOnlyPriorities).toEqual(['Reduce unused JavaScript'])
    expect(comparisonHeadline(comparison)).toContain('improved')
  })
})
