import { NextResponse } from 'next/server'

import { runDueScheduledAudits } from '@/lib/schedule-engine'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      limit?: unknown
    }

    const limit = Number(body.limit)
    const runs = await runDueScheduledAudits({
      limit: Number.isFinite(limit) ? limit : undefined,
    })

    return NextResponse.json({
      runs,
      completed: runs.filter((run) => run.success).length,
      failed: runs.filter((run) => !run.success).length,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to run scheduled audits.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
