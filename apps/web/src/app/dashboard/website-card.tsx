import Link from 'next/link'
import type { GenerationProgress } from '@awb/pipeline'
import { ResumeGeneration } from './resume-generation'
import { RerunAi } from './rerun-ai'

export function WebsiteCard({ project, index, canEdit, built, correlationId, progress, resumeJobId }: {
  project: { id: string; name: string; status: string; updatedAt: Date }
  index: number
  canEdit: boolean
  built: boolean
  resumeJobId?: string
  correlationId?: string
  progress?: GenerationProgress
}) {
  const generating = project.status === 'GENERATING'
  const available = built && !generating
  const progressHref = correlationId ? `/projects/${project.id}/progress?correlationId=${encodeURIComponent(correlationId)}` : undefined
  const failed = !!resumeJobId || progress?.status === 'failed'
  const activity = generating
    ? progress?.currentStage?.activity ?? 'Waiting for the worker to pick up the job…'
    : failed ? 'Generation needs attention. View progress for details.' : 'This website has not been built yet.'
  const cover = <><div className="wt-mini-browser"><i /><i /><i /><span>{project.name}</span></div><div className="wt-site-letter">{project.name.slice(0, 1)}</div><p>{project.name}</p><span className="wt-badge">{generating ? 'Building with AI' : failed ? 'Needs attention' : available ? project.status.toLowerCase() : 'Not built yet'}</span></>
  return <article className="wt-site-card">
    {available ? <Link href={`/preview/${project.id}`} className={`wt-site-cover tone-${index % 3}`}>{cover}</Link> : progressHref ? <Link href={progressHref} className={`wt-site-cover tone-${index % 3}`}>{cover}</Link> : <div className={`wt-site-cover tone-${index % 3}`}>{cover}</div>}
    <div className="wt-site-details">
      <h3>{project.name}</h3>
      <p className="wt-muted">Updated {project.updatedAt.toLocaleDateString('en-CA')}</p>
      {(generating || failed || !available) && <div className="my-4 rounded-lg border border-violet-100 bg-violet-50 p-3" role="status">
        <p className="text-sm font-semibold">{generating ? progress?.currentStage?.label ?? 'Generation queued' : failed ? 'Generation needs attention' : 'Waiting for a build'}</p>
        <p className="mt-1 text-xs text-neutral-600">{activity}</p>
        {generating && <><div role="progressbar" aria-label={`${project.name} generation progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress?.percent ?? 0} className="mt-3 h-2 overflow-hidden rounded-full bg-violet-100"><div className="h-full rounded-full bg-violet-600" style={{ width: `${progress?.percent ?? 0}%` }} /></div><p className="mt-2 text-xs text-neutral-600">{progress?.percent ?? 0}% complete · Working in the background</p></>}
      </div>}
      <div className="wt-site-actions">
        {canEdit && resumeJobId && !generating && <ResumeGeneration jobId={resumeJobId} />}
        {available ? <><Link className="wt-button" href={canEdit ? `/projects/${project.id}/editor` : `/preview/${project.id}`}>{canEdit ? 'Open editor' : 'View website'} ↗</Link><Link href={`/preview/${project.id}`} className="wt-button secondary">Preview</Link></> : progressHref && <Link href={progressHref} className="wt-button">View progress →</Link>}
      </div>
      <div className="wt-site-links">
        {available && <><Link href={`/projects/${project.id}/analytics`}>Analytics</Link><Link href={`/projects/${project.id}/publishing`}>Domains & publish</Link></>}
        {canEdit && <RerunAi projectId={project.id} generating={generating} />}
      </div>
    </div>
  </article>
}
