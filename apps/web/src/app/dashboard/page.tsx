import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@awb/database'
import { ContentJobNotifications } from '@/components/content-job-notifications'
import { AppShell } from '@/components/account/app-shell'
import { getGenerationProgress } from '@awb/pipeline'
import { GenerationRefresh } from './generation-refresh'
import { WebsiteCard } from './website-card'
import { currentUser, primaryWorkspace, requireWorkspace } from '@/lib/tenancy'
import { editingAccess, billingLifecycle } from '@/lib/billing/access'
export const dynamic = 'force-dynamic'
export default async function DashboardPage() {
  const user = await currentUser(); if (!user) redirect('/signin')
  const base = await primaryWorkspace(user.id); if (!base) redirect('/billing')
  const { membership } = await requireWorkspace(base.id)
  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: base.id }, include: { billingPlan: true } })
  if (!user.isPlatformAdmin && !user.isPlatformSupport && !editingAccess(workspace)) redirect('/billing?reason=payment-required')
  const state = billingLifecycle(workspace)
  const projects = await prisma.project.findMany({ where: { workspaceId: workspace.id }, orderBy: { updatedAt: 'desc' }, include: { hosting: { select: { previewHost: true, previewDeployedReleaseId: true, previewPendingReleaseId: true, previewStatus: true } }, generationJobs: { orderBy: { createdAt: 'desc' }, take: 1 }, contentJobs: { where: { kind: 'WEBSITE' }, orderBy: { createdAt: 'desc' }, take: 1 }, websiteVersions: { where: { kind: 'DRAFT' }, select: { id: true }, take: 1 } } })
  const generation = await Promise.all(projects.map(async (project) => {
    const content = project.contentJobs[0]
    const stage = project.generationJobs[0]
    const correlationId = content && (!stage || content.createdAt >= stage.createdAt) ? content.id : stage?.correlationId
    const progress = correlationId && (project.status === 'GENERATING' || content?.status === 'FAILED' || !project.websiteVersions.length) ? await getGenerationProgress(project.id, correlationId) : undefined
    return { correlationId, progress, resumeJobId: content?.status === 'FAILED' ? content.id : undefined }
  }))
  const canEdit = membership.role !== 'VIEWER' && editingAccess(workspace)
  const canCreate = canEdit && (workspace.billingExempt || projects.length < (workspace.billingPlan?.websiteLimit ?? 0))
  const activeJobs = projects.filter(project => project.status === 'GENERATING').length
  return <AppShell title="Your workspace" active="/dashboard"><GenerationRefresh active={activeJobs > 0} /><div className="wt-heading wt-heading-row"><div><p className="wt-eyebrow">GOOD TO SEE YOU, {user.name?.split(' ')[0]?.toUpperCase() ?? 'CREATOR'}</p><h1>Let’s build what’s next.</h1><p>Every website, every idea. All in one place.</p></div><Link href={canCreate ? '/onboarding' : '/billing'} className="wt-button">{canCreate ? '+ New website' : 'Explore plans →'}</Link></div><div className="wt-stats"><div className="wt-card"><span className="wt-muted">Your websites</span><strong>{projects.length}<small> / {workspace.billingExempt ? '∞' : workspace.billingPlan?.websiteLimit ?? 0}</small></strong></div><div className="wt-card"><span className="wt-muted">Published</span><strong>{projects.filter(project => project.status === 'PUBLISHED').length}</strong></div><div className="wt-card"><span className="wt-muted">Building with AI</span><strong>{activeJobs}</strong></div><div className="wt-card"><span className="wt-muted">Current package</span><strong className="wt-stat-plan">{workspace.billingExempt ? 'Complimentary' : workspace.billingPlan?.name ?? 'Payment required'}</strong><Link href="/billing">Manage plan →</Link></div></div>{!editingAccess(workspace) ? <div className="wt-notice"><strong>Your next website starts here.</strong> Your subscription payment needs attention. Choose a plan to resume editing and AI generation. Your saved websites stay safe. <Link href="/billing">Choose a package →</Link></div> : <div className="wt-dashboard-banner"><div><span className="wt-eyebrow">FROM IDEA TO ONLINE</span><h2>Your next big idea deserves a website.</h2><p>Let AI create a first draft, then make every detail your own.</p></div><span aria-hidden>✦</span></div>}{state.phase === 'TRIAL' && workspace.billingTrialEnd && <div className="wt-notice"><strong>Your 7-day trial is active with full access.</strong> It ends on {workspace.billingTrialEnd.toLocaleString('en-US', { timeZone: 'UTC', dateStyle: 'long', timeStyle: 'short' })} UTC. {workspace.cancelAtPeriodEnd ? 'Automatic billing is cancelled.' : 'US$29/month begins automatically afterward, subject to your checkout discount.'} <Link href="/billing">Manage or cancel trial →</Link></div>}{state.phase === 'GRACE' && <div className="wt-notice"><strong>Your renewal payment needs attention.</strong> Your website and editor remain available during the 7-day grace period. <Link href="/billing">Update payment →</Link></div>}<ContentJobNotifications /><div className="wt-section-title"><h2>Your websites <span className="wt-count">{projects.length}</span></h2><span className="wt-muted">Most recently updated first</span></div>{!projects.length && <section className="wt-empty"><span>✦</span><h2>A blank canvas, full of possibilities.</h2><p>Tell us about your business and we’ll help you build your first website.</p><Link href={canCreate ? '/onboarding' : '/billing'} className="wt-button">{canCreate ? 'Create your first website' : 'Choose your plan'}</Link></section>}<section className="wt-site-grid">{projects.map((project, index) => <WebsiteCard key={project.id} project={project} index={index} canEdit={canEdit} canShare={canEdit && (!user.isPlatformSupport || user.isPlatformAdmin)} built={project.websiteVersions.length > 0} {...generation[index]} />)}</section></AppShell>
}
