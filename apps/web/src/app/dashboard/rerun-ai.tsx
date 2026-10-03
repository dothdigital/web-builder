'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { startGeneration } from '@/app/actions/projects'

export function RerunAi({ projectId, generating }: { projectId: string; generating: boolean }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()

  async function rerun() {
    if (pending || generating) return
    setPending(true)
    setError(undefined)
    try {
      const { correlationId } = await startGeneration(projectId)
      router.push(`/projects/${projectId}/progress?correlationId=${encodeURIComponent(correlationId)}`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not restart generation. Please try again.')
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={rerun}
        disabled={pending || generating}
        className="rounded-md bg-neutral-900 px-3 py-1.5 text-white disabled:cursor-not-allowed disabled:opacity-50"
        title="Rebuild all stages from your saved business details and uploads, creating a new draft."
      >
        {pending ? 'Starting AI…' : generating ? 'AI running…' : 'Rerun with AI'}
      </button>
      {error && <p role="alert" className="max-w-xs text-xs text-red-700">{error}</p>}
    </div>
  )
}
