import { NextResponse } from 'next/server'

import { getAlertHistoryForTargetUrl } from '@/lib/alert-engine'
import { getAuditReport, getAuditReportsByTargetUrl } from '@/lib/audit-store'
import { buildAlertTrendSeries, buildAuditTrendSeries } from '@/lib/audit-trends'

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
  const auditTrend = buildAuditTrendSeries(
    await getAuditReportsByTargetUrl(audit.results.targetUrl, audit.userId, 8),
  )
  const alertHistory = await getAlertHistoryForTargetUrl(audit.results.targetUrl, audit.userId)
  const alertTrend = buildAlertTrendSeries(alertHistory.events, 8)

  if (format === 'csv') {
    const lines = [
      'section,label,createdAt,performance,accessibility,bestPractices,seo,alertCount,totalDelta,worstDelta',
      ...auditTrend.map((point) => [
        'scores',
        point.label,
        point.createdAt,
        point.performance,
        point.accessibility,
        point.bestPractices,
        point.seo,
        '',
        '',
        '',
      ].join(',')),
      ...alertTrend.map((point) => [
        'alerts',
        point.label,
        point.createdAt,
        '',
        '',
        '',
        '',
        point.alertCount,
        point.totalDelta,
        point.worstDelta,
      ].join(',')),
    ]

    return new NextResponse(lines.join('\n'), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="audit-trends-${id}.csv"`,
      },
    })
  }

  return NextResponse.json({
    audit: {
      id: audit.id,
      targetUrl: audit.results.targetUrl,
      createdAt: audit.createdAt,
    },
    scoreTrend: auditTrend,
    alertTrend,
  })
}
