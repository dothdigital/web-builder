import { HeaderMenuBehavior } from '@/components/header-menu-behavior'
import { prisma } from '@awb/database'
import { RecaptchaLoader } from '@/components/recaptcha-loader'
import { contactRoute } from '@/lib/contact-links'
import { notFound, redirect } from 'next/navigation'
import { buildFaqJsonLd, buildPageJsonLd, buildBlogJsonLd } from '@awb/seo'
import { SiteRenderer } from '@/components/site-renderer'
import { resolvePreviewAssets } from '@/lib/preview-assets'
import { loadDraftModel } from '@/lib/website'
import { requireProjectOnPage } from '@/lib/tenancy'
import { generationProgressHref } from '@/lib/generation-navigation'

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ projectId: string; path?: string[] }>
}) {
  const { projectId, path } = await params

  /// Previews are drafts, so they stay behind the same tenant check as the
  /// editor and are never publicly indexable.
  const { project } = await requireProjectOnPage(projectId)
  if (project.status === 'GENERATING') redirect(await generationProgressHref(projectId))

  const draft = await loadDraftModel(projectId)

  if (!draft) {
    notFound()
  }

  const model = await resolvePreviewAssets(projectId, draft)

  const route = `/${(path ?? []).join('/')}`.replace(/\/$/, '') || '/'
  const page = model.pages.find((candidate) => candidate.path === route)

  if (!page) {
    const target = route === '/contact' ? contactRoute(model) : undefined
    if (target && target !== route) redirect(`/preview/${projectId}${target}`)
    notFound()
  }

  const integration = await prisma.integration.findUnique({ where: { projectId } })
  const recaptchaSiteKey = integration?.recaptchaEnabled ? integration.recaptchaSiteKey ?? undefined : undefined
  const faq = buildFaqJsonLd(page)
  const siteUrl = `https://${model.site.primaryDomain || model.site.previewHost}`
  const structured = [buildPageJsonLd(model, page, siteUrl), buildBlogJsonLd(page, siteUrl), faq].filter(Boolean)

  return (
    <>
      <HeaderMenuBehavior />
      {<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, '\\u003c') }} />}
      <SiteRenderer model={model} page={page} baseUrl={`/preview/${projectId}`} forms={{ projectId, action: "/api/leads", recaptchaSiteKey }} />
      {recaptchaSiteKey && <RecaptchaLoader key={page.id} />}
    </>
  )
}

export const dynamic = 'force-dynamic'
