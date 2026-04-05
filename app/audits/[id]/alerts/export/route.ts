import { NextResponse } from 'next/server'

import { getAuditReport } from '@/lib/audit-store'
import { getAlertHistoryPageForTargetUrl } from '@/lib/alert-store'

export const runtime = 'nodejs'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const audit = await getAuditReport(id)

  if (!audit) {
    return NextResponse.json({ error: 'Audit not found.' }, { status: 404 })
  }

  const url = new URL(request.url)
  const format = url.searchParams.get('format') === 'csv' ? 'csv' : 'json'
  const metric = url.searchParams.get('metric') ?? undefined
  const status = url.searchParams.get('status') ?? undefined
  const history = await getAlertHistoryPageForTargetUrl(audit.results.targetUrl, audit.userId, {
    metric,
    status,
    page: Number(url.searchParams.get('page') ?? 1),
    pageSize: Number(url.searchParams.get('pageSize') ?? 100),
  })

  if (format === 'csv') {
    const lines = [
      'id,metricKey,metricLabel,previousScore,currentScore,delta,deliveryStatus,deliveryChannel,deliveryTarget,deliveryError,createdAt',
      ...history.events.map((event) =>
        [
          event.id,
          event.metricKey,
          event.metricLabel,
          event.previousScore,
          event.currentScore,
          event.delta,
          event.deliveryStatus ?? '',
          event.deliveryChannel ?? '',
          event.deliveryTarget ?? '',
          event.deliveryError ?? '',
          event.createdAt.toISOString(),
        ].join(','),
      ),
    ]

    return new NextResponse(lines.join('\n'), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="alert-history-${id}.csv"`,
      },
    })
  }

  return NextResponse.json({
    audit: {
      id: audit.id,
      targetUrl: audit.results.targetUrl,
      createdAt: audit.createdAt,
    },
    rule: history.rule,
    events: history.events,
    page: history.page,
    pageSize: history.pageSize,
    total: history.total,
    totalPages: history.totalPages,
  })
}
