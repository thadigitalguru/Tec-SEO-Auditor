import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

import { retryScheduledAudit } from '@/lib/schedule-engine'

export const runtime = 'nodejs'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { userId } = await auth()
    const saved = await retryScheduledAudit(id, userId ?? null)

    return NextResponse.json({
      audit: {
        id: saved.id,
        summary: saved.summary,
        createdAt: saved.createdAt,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to run schedule.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
