import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

import { deactivateScheduledAudit } from '@/lib/schedule-engine'
import { setScheduledAuditActive } from '@/lib/schedule-store'

export const runtime = 'nodejs'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = (await request.json().catch(() => ({}))) as { active?: unknown }
    const active = body.active === true
    const { userId } = await auth()

    const schedule = active
      ? await setScheduledAuditActive(id, true, userId ?? null)
      : await deactivateScheduledAudit(id, userId ?? null)

    return NextResponse.json({
      schedule: schedule
        ? {
            id: schedule.id,
            targetUrl: schedule.targetUrl,
            cadenceDays: schedule.cadenceDays,
            nextRunAt: schedule.nextRunAt,
            lastRunAt: schedule.lastRunAt,
            active: schedule.active,
          }
        : null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update schedule.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
