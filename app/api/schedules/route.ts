import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

import { saveScheduledAudit } from '@/lib/schedule-store'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      auditId?: unknown
      targetUrl?: unknown
      cadenceDays?: unknown
      startImmediately?: unknown
    }

    const auditId = typeof body.auditId === 'string' ? body.auditId.trim() : ''
    const targetUrl = typeof body.targetUrl === 'string' ? body.targetUrl.trim() : ''
    const cadenceDays = Number(body.cadenceDays)
    const startImmediately = body.startImmediately === true

    if (!auditId && !targetUrl) {
      return NextResponse.json({ error: 'A saved audit or URL is required.' }, { status: 400 })
    }

    if (!Number.isFinite(cadenceDays) || cadenceDays < 1) {
      return NextResponse.json({ error: 'A valid cadence is required.' }, { status: 400 })
    }

    const { userId } = await auth()
    const schedule = await saveScheduledAudit({
      auditId: auditId || undefined,
      targetUrl: targetUrl || undefined,
      cadenceDays,
      userId: userId ?? null,
      startImmediately,
    })

    return NextResponse.json({
      schedule: {
        id: schedule.id,
        targetUrl: schedule.targetUrl,
        cadenceDays: schedule.cadenceDays,
        nextRunAt: schedule.nextRunAt,
        lastRunAt: schedule.lastRunAt,
        active: schedule.active,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to schedule audit.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
