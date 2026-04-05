import { describe, expect, it, vi } from 'vitest'

vi.mock('./db', () => ({
  prisma: {
    audit: {
      findMany: vi.fn(),
    },
  },
}))

import { applyAuditHistoryQuery, type RecentAudit } from './audit-store'

const audits: RecentAudit[] = [
  {
    id: 'audit_1',
    summary: 'Improve performance',
    targetUrl: 'https://example.com/blog/post-one',
    createdAt: new Date('2026-03-03T12:00:00Z'),
    userId: null,
  },
  {
    id: 'audit_2',
    summary: 'SEO cleanup',
    targetUrl: 'https://example.com/',
    createdAt: new Date('2026-03-04T12:00:00Z'),
    userId: null,
  },
  {
    id: 'audit_3',
    summary: 'Accessibility pass',
    targetUrl: 'https://example.com/blog/post-two',
    createdAt: new Date('2026-03-05T12:00:00Z'),
    userId: null,
  },
]

describe('applyAuditHistoryQuery', () => {
  it('filters by search term and paginates in newest-first order by default', () => {
    const result = applyAuditHistoryQuery(audits, {
      search: 'blog',
      page: 1,
      pageSize: 1,
    })

    expect(result.total).toBe(2)
    expect(result.totalPages).toBe(2)
    expect(result.page).toBe(1)
    expect(result.hasNextPage).toBe(true)
    expect(result.hasPrevPage).toBe(false)
    expect(result.audits).toHaveLength(1)
    expect(result.audits[0]?.id).toBe('audit_3')
  })

  it('sorts oldest-first when requested and clamps invalid page numbers', () => {
    const result = applyAuditHistoryQuery(audits, {
      order: 'asc',
      page: 99,
      pageSize: 2,
    })

    expect(result.page).toBe(2)
    expect(result.total).toBe(3)
    expect(result.totalPages).toBe(2)
    expect(result.audits.map((audit) => audit.id)).toEqual(['audit_3'])
  })
})
