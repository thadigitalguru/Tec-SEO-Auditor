import { NextResponse } from 'next/server'

import { formatAuditExportFilename, serializeAuditAsCsv, type AuditExportFormat } from '@/lib/audit-export'
import { getAuditReport } from '@/lib/audit-store'

function readFormat(value: string | null): AuditExportFormat {
  return value === 'csv' ? 'csv' : 'json'
}

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
  const format = readFormat(url.searchParams.get('format'))

  if (format === 'csv') {
    return new NextResponse(serializeAuditAsCsv(audit), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${formatAuditExportFilename(audit, format)}"`,
      },
    })
  }

  return NextResponse.json(audit, {
    headers: {
      'content-disposition': `attachment; filename="${formatAuditExportFilename(audit, format)}"`,
    },
  })
}
