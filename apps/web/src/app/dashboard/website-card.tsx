import { intakeMediaSchema } from '@awb/shared/intake-media'
import Link from 'next/link'
import type { GenerationProgress } from '@awb/pipeline'
import { RerunAi } from './rerun-ai'
import type { AnalyticsReport } from '@/lib/analytics-reports'
import { TestLink } from './test-link'

export function WebsiteCard({ project, index, canEdit, canShare = canEdit, built, correlationId, progress, analytics }: {
  project: { intakeMedia?: unknown; id: string; name: string; status: string; updatedAt: Date; domains?: { hostname: string }[]; hosting?: { publicHost: string | null; deployedReleaseId: string | null; billingGateApplied: boolean; status: string; previewHost: string | null; previewDeployedReleaseId: string | null; previewPendingReleaseId: string | null; previewStatus: string } | null }
  analytics?: AnalyticsReport | null
  index: number
  canEdit: boolean
  canShare?: boolean
  built: boolean
  correlationId?: string
  progress?: GenerationProgress
}) {
  const media = intakeMediaSchema.safeParse(project.intakeMedia)
  const live = !!(project.hosting?.deployedReleaseId && project.hosting.publicHost && !project.hosting.billingGateApplied && project.hosting.status !== 'SUSPENDED')
  const liveHost = project.domains?.[0]?.hostname ?? project.hosting?.publicHost
  const generating = project.status === 'GENERATING'
  const available = built && !generating
  const progressHref = correlationId ? `/projects/${project.id}/progress?correlationId=${encodeURIComponent(correlationId)}` : undefined
  const failed = progress?.status === 'failed'
  const activity = generating
    ? progress?.currentStage?.activity ?? 'Waiting for the worker to pick up the job…'
    : failed ? 'Generation needs attention. View progress for details.' : 'This website has not been built yet.'
  const cover = <><div className="wt-mini-browser"><i /><i /><i /><span>{project.name}</span></div><div className="wt-site-letter">{project.name.slice(0, 1)}</div><p>{project.name}</p><span className="wt-badge">{generating ? 'Building with AI' : failed ? 'Needs attention' : available ? 'In development' : 'Not built yet'}</span></>
  return <article className="wt-site-card">
    {available ? <Link href={`/preview/${project.id}`} className={`wt-site-cover tone-${index % 3}`}><div className="wt-site-thumbnail"><iframe src={`/preview/${project.id}`} title={`${project.name} thumbnail`} loading="lazy" sandbox="allow-same-origin" tabIndex={-1} /><span className="wt-thumbnail-label">Open preview ↗</span></div></Link> : progressHref ? <Link href={progressHref} className={`wt-site-cover tone-${index % 3}`}>{cover}</Link> : <div className={`wt-site-cover tone-${index % 3}`}>{cover}</div>}
    <div className="wt-site-details">
      <div className="wt-site-title"><h3>{project.name}</h3><div className="wt-site-live-control"><span className={`wt-site-status ${live ? 'is-live' : 'is-development'}`}>{live ? '● Live' : project.hosting?.billingGateApplied || project.hosting?.status === 'SUSPENDED' ? '● Suspended' : '● In development'}</span>
        {live && <a className="wt-button wt-view-site" href={`https://${liveHost}`} target="_blank" rel="noreferrer">View site ↗</a>}
      </div></div>
      <p className="wt-muted">Updated {project.updatedAt.toLocaleDateString('en-CA')}</p>
      {(generating || !available) && <div className="my-4 rounded-lg border border-violet-100 bg-violet-50 p-3" role="status">
        <p className="text-sm font-semibold">{generating ? progress?.currentStage?.label ?? 'Generation queued' : failed ? 'Generation needs attention' : 'Waiting for a build'}</p>
        <p className="mt-1 text-xs text-neutral-600">{activity}</p>
        {generating && <><div role="progressbar" aria-label={`${project.name} generation progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress?.percent ?? 0} className="mt-3 h-2 overflow-hidden rounded-full bg-violet-100"><div className="h-full rounded-full bg-violet-600" style={{ width: `${progress?.percent ?? 0}%` }} /></div><p className="mt-2 text-xs text-neutral-600">{progress?.percent ?? 0}% complete · Working in the background</p></>}
      </div>}
      {live && <section className="wt-site-analytics" aria-label={`${project.name} statistics`}>
        <div className="wt-site-analytics-heading"><strong>Website statistics</strong><span>Last 30 days · UTC</span></div>
        {analytics ? <><div className="wt-site-metrics"><div><span>Page views</span><strong>{analytics.views.toLocaleString()}</strong></div><div><span>Visitors</span><strong>{analytics.visitors.toLocaleString()}</strong></div></div>
          {analytics.pages.length ? <table className="wt-page-stats"><caption>Top pages · Page views</caption><tbody>{analytics.pages.slice(0, 3).map(page => <tr key={page.label}><th scope="row">{page.label}</th><td>{page.value.toLocaleString()}</td></tr>)}</tbody></table> : <p className="wt-muted">No visits recorded yet. Page statistics will appear as visitors arrive.</p>}
        </> : <p className="wt-muted">Statistics are temporarily unavailable. Open Analytics to try again.</p>}
      </section>}
      {!live && available && <p className="wt-site-development-note">Publish your website to go live and see visitor and page statistics here.</p>}
      <div className="wt-site-actions wt-site-toolbar">
        {available ? <>
          {canEdit && <Link className="wt-button" href={`/projects/${project.id}/editor`}>Open editor ↗</Link>}
          <Link href={`/projects/${project.id}/analytics`} className="wt-button secondary">Analytics</Link>
          <Link href={`/projects/${project.id}/publishing`} className="wt-button secondary">{live ? 'Manage domain' : 'Publish website'}</Link>
        </> : progressHref && <Link href={progressHref} className="wt-button">View progress →</Link>}

        {available && canShare && <TestLink projectId={project.id} name={project.name} initialUrl={project.hosting?.previewDeployedReleaseId && project.hosting.previewHost && project.hosting.previewStatus !== 'SUSPENDED' ? `https://${project.hosting.previewHost}` : null} pending={!!project.hosting?.previewPendingReleaseId} />}
        {canEdit && <RerunAi initialImageDirection={media.success ? media.data.imageDirection : undefined} projectId={project.id} generating={generating} built={built} />}
      </div>

    </div>
  </article>
}
