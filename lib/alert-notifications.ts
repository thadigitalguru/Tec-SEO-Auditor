import type {
  AlertDeliveryChannel,
  AlertDeliveryStatus,
  ScoreAlertEvent,
  ScoreAlertRule,
} from './alert-store'

export interface AlertNotificationPayload {
  title: string
  summary: string
  rule: ScoreAlertRule
  event: ScoreAlertEvent
}

export async function deliverAlertNotification(
  rule: ScoreAlertRule,
  event: ScoreAlertEvent,
): Promise<{ status: AlertDeliveryStatus; error: string | null; deliveredAt: Date | null }> {
  const target = rule.deliveryTarget

  if (!target) {
    return { status: 'skipped', error: 'No delivery target configured.', deliveredAt: null }
  }

  const payload = buildAlertNotificationPayload(rule, event)

  try {
    if (rule.deliveryChannel === 'webhook') {
      const response = await fetch(target, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        return {
          status: 'failed',
          error: `Webhook responded with ${response.status}.`,
          deliveredAt: null,
        }
      }

      return { status: 'sent', error: null, deliveredAt: new Date() }
    }

    return await sendEmailNotification(target, payload)
  } catch (error) {
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unable to deliver alert.',
      deliveredAt: null,
    }
  }
}

export function buildAlertNotificationPayload(
  rule: ScoreAlertRule,
  event: ScoreAlertEvent,
): AlertNotificationPayload {
  return {
    rule,
    event,
    title: `${event.metricLabel} dropped by ${Math.abs(event.delta)} points`,
    summary: `Audit ${event.auditId} dropped from ${event.previousScore} to ${event.currentScore}.`,
  }
}

export function summarizeAlertDelivery(
  event: ScoreAlertEvent,
  rule: ScoreAlertRule,
) {
  const channel = rule.deliveryChannel
  const target = rule.deliveryTarget
  const status = event.deliveryStatus ?? 'queued'

  return {
    channel,
    target,
    status,
    summary:
      status === 'failed'
        ? event.deliveryError ?? 'Delivery failed.'
        : status === 'sent'
          ? `Delivered via ${channel}${target ? ` to ${target}` : ''}.`
          : status === 'skipped'
            ? event.deliveryError ?? 'Delivery skipped.'
            : 'Queued for delivery.',
  }
}

async function sendEmailNotification(
  targetEmail: string,
  payload: AlertNotificationPayload,
): Promise<{ status: AlertDeliveryStatus; error: string | null; deliveredAt: Date | null }> {
  const apiKey = process.env.RESEND_API_KEY
  const fromAddress = process.env.RESEND_FROM_ADDRESS

  if (!apiKey || !fromAddress) {
    return { status: 'skipped', error: 'Email provider not configured.', deliveredAt: null }
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: fromAddress,
      to: targetEmail,
      subject: payload.title,
      html: `<h1>${payload.title}</h1><p>${payload.summary}</p><pre>${JSON.stringify(payload.event, null, 2)}</pre>`,
    }),
  })

  if (!response.ok) {
    return {
      status: 'failed',
      error: `Email provider responded with ${response.status}.`,
      deliveredAt: null,
    }
  }

  return { status: 'sent', error: null, deliveredAt: new Date() }
}

export function validateDeliveryTarget(
  deliveryChannel: AlertDeliveryChannel,
  value: string,
) {
  const trimmed = value.trim()

  if (!trimmed) {
    return 'A delivery target is required.'
  }

  if (deliveryChannel === 'email') {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
      ? null
      : 'Enter a valid email address.'
  }

  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return 'Webhook URLs must use http or https.'
    }
    return null
  } catch {
    return 'Enter a valid webhook URL.'
  }
}
