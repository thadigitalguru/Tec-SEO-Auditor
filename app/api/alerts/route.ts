import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

import { ensureScoreAlertRule } from '@/lib/alert-engine'
import { getAuditReport } from '@/lib/audit-store'
import { validateDeliveryTarget } from '@/lib/alert-notifications'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      auditId?: unknown
      targetUrl?: unknown
      dropPoints?: unknown
      active?: unknown
      deliveryChannel?: unknown
      deliveryTarget?: unknown
      cooldownHours?: unknown
    }

    const auditId = typeof body.auditId === 'string' ? body.auditId.trim() : ''
    const targetUrl = typeof body.targetUrl === 'string' ? body.targetUrl.trim() : ''
    const dropPoints = Number(body.dropPoints)
    const active = body.active === undefined ? undefined : body.active === true
    const deliveryChannel =
      body.deliveryChannel === 'email' || body.deliveryChannel === 'webhook'
        ? body.deliveryChannel
        : undefined
    const deliveryTarget =
      typeof body.deliveryTarget === 'string' ? body.deliveryTarget.trim() : undefined
    const cooldownHours = Number(body.cooldownHours)

    if (!auditId && !targetUrl) {
      return NextResponse.json({ error: 'A saved audit or URL is required.' }, { status: 400 })
    }

    if (!Number.isFinite(dropPoints) || dropPoints < 1) {
      return NextResponse.json({ error: 'A valid drop threshold is required.' }, { status: 400 })
    }

    if (deliveryChannel && deliveryTarget) {
      const targetError = validateDeliveryTarget(deliveryChannel, deliveryTarget)
      if (targetError) {
        return NextResponse.json({ error: targetError }, { status: 400 })
      }
    }

    if (Number.isFinite(cooldownHours) && (cooldownHours < 0 || cooldownHours > 168)) {
      return NextResponse.json({ error: 'Cooldown must be between 0 and 168 hours.' }, { status: 400 })
    }

    const { userId } = await auth()
    const rule = await ensureScoreAlertRule(
      targetUrl || await resolveTargetUrlFromAuditId(auditId),
      dropPoints,
      userId ?? null,
      {
        active,
        deliveryChannel,
        deliveryTarget,
        cooldownHours: Number.isFinite(cooldownHours) ? cooldownHours : undefined,
      },
    )

    return NextResponse.json({
      rule: {
        id: rule.id,
        targetUrl: rule.targetUrl,
        dropPoints: rule.dropPoints,
        active: rule.active,
        deliveryChannel: rule.deliveryChannel,
        deliveryTarget: rule.deliveryTarget,
        cooldownHours: rule.cooldownHours,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save alert.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function resolveTargetUrlFromAuditId(auditId: string) {
  if (!auditId) {
    throw new Error('A saved audit URL is required.')
  }

  const audit = await getAuditReport(auditId)
  if (!audit) {
    throw new Error('Audit not found.')
  }

  return audit.results.targetUrl
}
