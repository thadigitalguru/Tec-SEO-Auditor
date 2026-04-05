'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export function AuditForm() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    startTransition(async () => {
      try {
        const response = await fetch('/api/audit', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({ url }),
        })

        const payload = (await response.json()) as
          | { redirectTo: string }
          | { error: string }

        if (!response.ok) {
          setError('error' in payload ? payload.error : 'Unable to run audit.')
          return
        }

        if ('redirectTo' in payload) {
          router.push(payload.redirectTo)
          return
        }

        setError('Unable to run audit.')
      } catch {
        setError('Unable to run audit.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="mt-10 flex flex-col gap-4 sm:flex-row">
      <label className="flex-1">
        <span className="sr-only">Website URL</span>
        <input
          name="url"
          type="url"
          required
          placeholder="https://example.com"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          className="h-14 w-full rounded-2xl border border-white/15 bg-slate-950/70 px-5 text-base text-white outline-none ring-0 placeholder:text-slate-500 focus:border-cyan-300"
        />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="h-14 rounded-2xl bg-cyan-300 px-6 text-base font-semibold text-slate-950 transition-colors hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? 'Running audit...' : 'Run audit'}
      </button>
      {error ? <p className="sm:col-span-2 text-sm text-rose-300">{error}</p> : null}
    </form>
  )
}
