'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface StageProgress {
  stage: string
  label: string
  activity: string
  status: 'PENDING' | 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED'
  attempts: number
  errorMessage?: string
  startedAt?: string
  finishedAt?: string
  note?: string
}

interface Progress {
  percent: number
  status: 'pending' | 'running' | 'succeeded' | 'failed'
  stages: StageProgress[]
  currentStage?: StageProgress
}

const statusIcon: Record<StageProgress['status'], string> = {
  PENDING: '○', QUEUED: '○', RUNNING: '◐', SUCCEEDED: '✓', FAILED: '✕', CANCELLED: '–',
}

function elapsed(start: string | undefined, now: number): string {
  if (!start || !now) return '—'
  const seconds = Math.max(0, Math.floor((now - Date.parse(start)) / 1000))
  if (!Number.isFinite(seconds)) return '—'
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

export function ProgressView({ projectId, correlationId }: { projectId: string; correlationId: string }) {
  const router = useRouter()
  const [progress, setProgress] = useState<Progress>()
  const [streamError, setStreamError] = useState<string>()
  const [lastUpdate, setLastUpdate] = useState(0)
  const [now, setNow] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const source = new EventSource(`/api/projects/${projectId}/progress?correlationId=${encodeURIComponent(correlationId)}`)

    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as Progress & { error?: string }
        if (!Array.isArray(payload.stages)) {
          setStreamError(payload.error || 'Progress is temporarily unavailable. Reconnecting…')
          return
        }
        setProgress(payload)
        setLastUpdate(Date.now())
        setStreamError(undefined)
        if (payload.status === 'succeeded') {
          source.close()
          router.push(`/projects/${projectId}/editor`)
        } else if (payload.status === 'failed') {
          source.close()
        }
      } catch {
        setStreamError('Could not read the latest update. Waiting for the next one…')
      }
    }

    source.onerror = () => {
      // EventSource reconnects automatically; keep the last known state visible.
      setStreamError('Reconnecting to live updates. Your generation continues in the background.')
    }
    return () => source.close()
  }, [projectId, correlationId, router])

  const stages = progress?.stages ?? []
  const current = progress?.currentStage
  const failed = stages.find((stage) => stage.status === 'FAILED')
  const completed = stages.filter((stage) => stage.status === 'SUCCEEDED')
  const activity = [...stages].filter((stage) => stage.startedAt).sort((a, b) =>
    Date.parse(b.finishedAt && b.status !== 'RUNNING' ? b.finishedAt : b.startedAt!) - Date.parse(a.finishedAt && a.status !== 'RUNNING' ? a.finishedAt : a.startedAt!),
  )
  const finished = progress?.status === 'succeeded' || progress?.status === 'failed'
  const connected = lastUpdate > 0 && !streamError && (!now || now - lastUpdate < 10000)

  return (
    <main className="mx-auto max-w-7xl px-6 py-10 lg:py-16">
      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:gap-14">
        <section aria-labelledby="build-heading">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Website generation</p>
          <h1 id="build-heading" className="text-3xl font-semibold tracking-tight sm:text-4xl">Building your website</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-neutral-600">
            {failed ? 'Generation needs attention. See the details on the right.' : current?.activity ?? (finished ? 'Your website is ready. Opening the editor…' : 'Waiting for the worker to pick up the job…')}
          </p>
          <div role="progressbar" aria-label="Overall generation progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress?.percent ?? 0} className="mt-7 h-2.5 w-full overflow-hidden rounded-full bg-neutral-200">
            <div className="h-full rounded-full bg-neutral-900 transition-all duration-500" style={{ width: `${progress?.percent ?? 0}%` }} />
          </div>
          <div className="mt-3 flex justify-between text-xs text-neutral-500"><span>{progress?.percent ?? 0}% complete</span><span>{completed.length} of {stages.length || 9} steps complete</span></div>
          {stages.filter(stage => stage.note).map(stage => <p key={stage.stage} role="status" className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-950">{stage.note}</p>)}
          <ol className="mt-8 grid gap-3">
            {stages.map((stage) => (
              <li key={stage.stage} className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${stage.status === 'RUNNING' ? 'border-blue-200 bg-blue-50' : stage.status === 'FAILED' ? 'border-red-200 bg-red-50' : 'border-neutral-200 bg-white'}`}>
                <span aria-hidden="true" className={`mt-0.5 ${stage.status === 'SUCCEEDED' ? 'text-emerald-600' : stage.status === 'RUNNING' ? 'text-blue-600' : 'text-neutral-400'}`}>{statusIcon[stage.status]}</span>
                <div className="min-w-0 flex-1"><span className="block font-medium">{stage.label}</span><span className="mt-1 block text-xs leading-5 text-neutral-500">{stage.activity}</span>{stage.attempts > 1 && <span className="mt-1 block text-xs text-amber-700">Attempt {stage.attempts}</span>}</div>
                {stage.status === 'SUCCEEDED' && <span className="text-xs text-emerald-700">Done</span>}
              </li>
            ))}
          </ol>
        </section>

        <aside className="rounded-2xl border border-neutral-200 bg-white shadow-sm lg:sticky lg:top-8" aria-label="Live generation activity">
          <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-5">
            <h2 className="font-semibold">Live activity</h2>
            <span className={`flex items-center gap-2 text-xs ${finished ? 'text-neutral-500' : connected ? 'text-emerald-700' : 'text-amber-700'}`}><span className={`h-2 w-2 rounded-full ${finished ? 'bg-neutral-400' : connected ? 'bg-emerald-500 motion-safe:animate-pulse' : 'bg-amber-400'}`} />{finished ? 'Finished' : connected ? 'Live' : 'Connecting'}</span>
          </div>
          <div className="p-6">
            <div aria-live="polite" aria-atomic="true">
              <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">{failed ? 'Needs attention' : current ? 'Working on now' : finished ? 'Complete' : 'Up next'}</p>
              <h3 className="mt-3 text-xl font-semibold">{failed?.label ?? current?.label ?? (finished ? 'Website ready' : 'Starting your build')}</h3>
              <p className="mt-2 text-sm leading-6 text-neutral-600">{failed?.errorMessage ?? current?.activity ?? (finished ? 'Taking you to the editor.' : 'The latest worker activity will appear here automatically.')}</p>
            </div>
            {current && !failed && <div className="mt-5 flex justify-between rounded-lg bg-neutral-50 px-4 py-3 text-sm"><span className="text-neutral-500">Time on this step</span><span className="font-medium tabular-nums">{elapsed(current.startedAt, now)}</span></div>}
            <h3 className="mt-8 text-xs font-semibold uppercase tracking-wider text-neutral-500">Recent activity</h3>
            <ol className="mt-4 grid gap-4">
              {activity.slice(0, 6).map((stage) => <li key={stage.stage} className="flex gap-3 text-sm"><span aria-hidden="true" className={stage.status === 'SUCCEEDED' ? 'text-emerald-600' : 'text-blue-600'}>{statusIcon[stage.status]}</span><div><p className="font-medium">{stage.label}</p><p className="mt-1 text-xs text-neutral-500">{stage.status === 'SUCCEEDED' ? 'Completed' : stage.status === 'FAILED' ? 'Failed' : 'In progress'}{stage.attempts > 1 ? ` · attempt ${stage.attempts}` : ''}</p></div></li>)}
              {activity.length === 0 && <li className="text-sm text-neutral-500">Waiting for the first update…</li>}
            </ol>
            <p className="mt-6 border-t border-neutral-100 pt-4 text-xs leading-5 text-neutral-400">{lastUpdate ? `Last update ${Math.max(0, Math.floor((now - lastUpdate) / 1000))}s ago` : 'Updates arrive automatically.'} Overall progress advances when a step finishes.</p>
            {streamError && <p role="status" className="mt-4 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800">{streamError}</p>}
            {failed && <a href="/dashboard" className="mt-5 inline-block rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white">Back to dashboard</a>}
          </div>
        </aside>
      </div>
    </main>
  )
}
