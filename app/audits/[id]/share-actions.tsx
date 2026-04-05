'use client'

import { useState } from 'react'

interface ShareActionsProps {
  shareUrl: string
}

export function ShareActions({ shareUrl }: ShareActionsProps) {
  const [copyLabel, setCopyLabel] = useState('Copy share link')

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopyLabel('Copied')
      window.setTimeout(() => setCopyLabel('Copy share link'), 1500)
    } catch {
      setCopyLabel('Copy failed')
      window.setTimeout(() => setCopyLabel('Copy share link'), 1500)
    }
  }

  return (
    <div className="flex flex-wrap gap-3">
      <a
        href={shareUrl}
        className="inline-flex h-11 items-center justify-center rounded-full border border-white/15 px-5 text-sm font-medium text-white transition-colors hover:border-cyan-300/60 hover:text-cyan-200"
      >
        Shareable report link
      </a>
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex h-11 items-center justify-center rounded-full border border-white/15 px-5 text-sm font-medium text-white transition-colors hover:border-cyan-300/60 hover:text-cyan-200"
      >
        {copyLabel}
      </button>
      <a
        href={`${shareUrl}/export`}
        className="inline-flex h-11 items-center justify-center rounded-full bg-cyan-300 px-5 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-200"
      >
        Export JSON
      </a>
      <a
        href={`${shareUrl}/export?format=csv`}
        className="inline-flex h-11 items-center justify-center rounded-full border border-white/15 px-5 text-sm font-medium text-white transition-colors hover:border-cyan-300/60 hover:text-cyan-200"
      >
        Export CSV
      </a>
    </div>
  )
}
