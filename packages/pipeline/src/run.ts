import { savedStageResult } from './saved-stage-result'
import { generationOptionsSchema, contentDirectionPrompt, imageDirectionPrompt } from '@awb/shared'
import { canGenerate } from './billing-access'
import { enrichServiceDetailPages, rewritePageWithAi } from './content-generation'
import { createHash, randomUUID } from 'node:crypto'
import {
  AssetKind,
  AssetSource,
  GenerationStage,
  JobStatus,
  PageStatus,
  ProjectStatus,
  WebsiteVersionKind,
  prisma,
} from '@awb/database'
import type { Prisma } from '@awb/database'
import {
  createAiProvider,
  paletteAlternatives,
  type AiProvider,
  type BriefAnalysis,
  type DesignDirections,
  type GenerationBrief,
  type ImageSlotRequest,
  type SitePlan,
} from '@awb/ai'
import {
  defaultTokens,
  templateImageSubject,
  alignTemplateServiceCards,
  normalizeSiteHeadings,
  emptyImagePointers,
  getComponent,
  validateSectionProps,
  getLayoutTemplate,
  templatePageComponents,
  initialTemplateProps,
  templateChromeProps,
  ensureServiceDetailPages,
  ensureContactPageLayout,
} from '@awb/component-registry'
import {
  websiteModelSchema,
  WEBSITE_MODEL_SCHEMA_VERSION,
  buildFingerprint,
  validateWebsiteModel,
  type DesignDna,
  type DesignTokens,
  type AnalyticsSettings,
  type GoogleSettings,
  type SiteContact,
  type SocialLinkEntry,
  type WebsiteModel,
  type WebsitePage,
} from '@awb/website-model'
import { auditHeadings } from '@awb/seo'
import { assetKey, getStorage } from '@awb/shared'
import { applyTestimonials } from './testimonials'
import { designReferenceSchema } from '@awb/shared/design-reference'
import { inspectDesignReference } from './design-reference'

/// Writes a value addressed by a JSON pointer, creating intermediate objects
/// so nested image slots (e.g. `/images/2/url`) can be filled.
function setByPointer(target: Record<string, unknown>, pointer: string, value: string): void {
  const segments = pointer.replace(/^\//, '').split('/')
  let cursor: Record<string, unknown> = target

  for (const [index, segment] of segments.entries()) {
    if (index === segments.length - 1) {
      cursor[segment] = value
      return
    }

    const next = cursor[segment]

    if (typeof next !== 'object' || next === null) {
      cursor[segment] = {}
    }

    cursor = cursor[segment] as Record<string, unknown>
  }
}

function sectionHeading(props: Record<string, unknown>): string | undefined {
  for (const key of ['heading', 'title', 'eyebrow']) {
    const value = props[key]

    if (typeof value === 'string' && value.trim().length > 0) {
      return value
    }
  }

  return undefined
}

export function collectImageSlots(model: WebsiteModel): ImageSlotRequest[] {
  const slots: ImageSlotRequest[] = []

  for (const page of model.pages) {
    for (const section of page.sections) {
      if (section.hidden) continue
      const props = section.props as Record<string, unknown>
      const definition = getComponent(section.componentId)

      if (!definition || definition.family === 'HEADER' || definition.family === 'FOOTER') {
        continue
      }

      for (const pointer of emptyImagePointers(section.componentId, props)) {
        slots.push({
          slot: `${page.id}:${section.id}:${pointer}`,
          pageTitle: page.title,
          componentId: section.componentId,
          family: definition.family,
          subjectContext: JSON.stringify({
            exactImageSubject: templateImageSubject(section.componentId,pointer,props),
            section: props,
            imageOwner: pointer.split('/').slice(1, -1).reduce<unknown>((value, key) =>
              value && typeof value === 'object' ? (value as Record<string, unknown>)[key.replace(/~1/g, '/').replace(/~0/g, '~')] : undefined, props),
          }),
          ...(sectionHeading(props) ? { heading: sectionHeading(props) as string } : {}),
        })
      }
    }
  }

  return slots
}

const IMAGE_PLAN_BATCH_SIZE = 6

export interface GenerationRequest {
  contentJobId?: string
  projectId: string
  correlationId?: string
  /// Set when the user picked one of the proposed art directions up front.
  selectedDirectionId?: string
}

class StageError extends Error {
  constructor(
    readonly stage: GenerationStage,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message)
  }
}

/// Runs one stage as its own auditable, retryable unit of work. Every stage
/// writes a generation_jobs row before it starts, so the progress stream has
/// something to show even if the process dies mid-stage.
async function runStage<T>(
  projectId: string,
  correlationId: string,
  stage: GenerationStage,
  input: Prisma.InputJsonValue,
  handler: () => Promise<{ output: Prisma.InputJsonValue; result: T; usage?: { model: string; inputTokens: number; outputTokens: number; costCents: number } }>,
): Promise<T> {
  const existing = await prisma.generationJob.findFirst({ where: { projectId, correlationId, stage } })
  if (existing?.status === JobStatus.SUCCEEDED) {
    const cached = savedStageResult(stage,existing.output)
    if (cached.found) return cached.value as T
  }
  // Older automatic retries could mark copy failed after composition had
  // already succeeded. Recover the copy from that completed model.
  if (stage === GenerationStage.CONTENT && existing?.status !== JobStatus.SUCCEEDED) {
    const composed = await prisma.generationJob.findFirst({where:{projectId,correlationId,stage:GenerationStage.COMPOSE,status:JobStatus.SUCCEEDED},select:{output:true}})
    const pages = (composed?.output as {model?:WebsiteModel} | null)?.model?.pages
    if (pages?.length && existing) {
      await prisma.generationJob.update({where:{id:existing.id},data:{status:JobStatus.SUCCEEDED,errorMessage:null,finishedAt:new Date(),output:toJson({pages,completed:pages.length,total:pages.length,unit:'pages',stageResult:pages})}})
      return pages as T
    }
  }
  const job = existing
    ? await prisma.generationJob.update({
        where: { id: existing.id },
        data: { status: JobStatus.RUNNING, startedAt: new Date(), attempts: { increment: 1 }, errorMessage: null, finishedAt: null },
      })
    : await prisma.generationJob.create({
        data: {
          projectId,
          correlationId,
          stage,
          status: JobStatus.RUNNING,
          input,
          attempts: 1,
          startedAt: new Date(),
        },
      })

  try {
    const { output, result, usage } = await handler()

    await prisma.generationJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.SUCCEEDED,
        output: toJson({ ...(output as Record<string,unknown>), stageResult:result }),
        finishedAt: new Date(),
        ...(usage
          ? {
              model: usage.model,
              inputTokens: usage.inputTokens,
              outputTokens: usage.outputTokens,
              costCents: usage.costCents,
            }
          : {}),
      },
    })

    return result
  } catch (error) {
    await prisma.generationJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.FAILED,
        errorMessage: error instanceof Error ? error.message : String(error),
        finishedAt: new Date(),
      },
    })

    throw new StageError(stage, `Stage ${stage} failed: ${error instanceof Error ? error.message : String(error)}`, error)
  }
}

interface BusinessPresence {
  socials: SocialLinkEntry[]
  contact: SiteContact
  google: GoogleSettings
  analytics: AnalyticsSettings
}

/// Contact, social and Google details are facts the user supplied; they are
/// copied into the model verbatim so no stage can invent them.
async function loadPresence(projectId: string): Promise<BusinessPresence> {
  const [business, socialLinks, integration] = await Promise.all([
    prisma.businessProfile.findUnique({ where: { projectId } }),
    prisma.socialLink.findMany({ where: { projectId, enabled: true }, orderBy: { position: 'asc' } }),
    prisma.integration.findUnique({ where: { projectId } }),
  ])

  const hours = Array.isArray(business?.hours)
    ? (business.hours as Array<{ day: string; opens: string; closes: string; closed?: boolean }>).map((entry) => ({
        day: entry.day,
        opens: entry.opens,
        closes: entry.closes,
        closed: entry.closed ?? false,
      }))
    : []

  return {
    socials: socialLinks.map((link) => ({
      network: link.network,
      url: link.url,
      ...(link.label ? { label: link.label } : {}),
    })),
    contact: {
      ...(business?.email ? { email: business.email } : {}),
      ...(business?.phone ? { phone: business.phone } : {}),
      ...(business?.whatsapp ? { whatsapp: business.whatsapp } : {}),
      ...(business?.addressLine1 ? { addressLine1: business.addressLine1 } : {}),
      ...(business?.addressLine2 ? { addressLine2: business.addressLine2 } : {}),
      ...(business?.city ? { city: business.city } : {}),
      ...(business?.region ? { region: business.region } : {}),
      ...(business?.postalCode ? { postalCode: business.postalCode } : {}),
      ...(business?.country ? { country: business.country } : {}),
      hours,
    },
    google: {
      ...(integration?.googleBusinessUrl ? { businessProfileUrl: integration.googleBusinessUrl } : {}),
      ...(integration?.googleMapsUrl ? { mapsUrl: integration.googleMapsUrl } : {}),
      ...(integration?.googlePlaceId ? { placeId: integration.googlePlaceId } : {}),
      ...(integration?.googleVerification ? { searchConsoleVerification: integration.googleVerification } : {}),
    },
    analytics: {
      ...(integration?.ga4MeasurementId ? { ga4MeasurementId: integration.ga4MeasurementId } : {}),
      ...(integration?.gtmContainerId ? { gtmContainerId: integration.gtmContainerId } : {}),
      conversionEvents: integration?.conversionEvents ?? [],
    },
  }
}

async function loadBrief(projectId: string): Promise<GenerationBrief> {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      businessProfile: true,
      brandProfile: { include: { logo: true } },
      assets: { where: { kind: AssetKind.IMAGE, source: AssetSource.UPLOAD } },
      collections: { include: { items: { orderBy: { position: 'asc' } } } },
    },
  })

  const business = project.businessProfile
  const testimonialCollection = project.collections.find((collection) => collection.type === 'TESTIMONIALS')
  const reference = designReferenceSchema.safeParse(project.designReference)

  return {
    businessName: business?.displayName ?? project.name,
    ...(process.env.NEXT_PUBLIC_ENABLE_LAYOUT_TEMPLATES === 'true' && project.templateId && getLayoutTemplate(project.templateId) ? { templateId: project.templateId } : {}),
    ...(reference.success ? { designReference: reference.data } : {}),
    homepageSections: project.homepageSections,
    homepageLength: project.homepageLength === 'expanded' ? 'expanded' : 'compact',
    description: business?.description ?? '',
    ...(business?.industry ? { industry: business.industry } : {}),
    ...(business?.city ? { location: [business.city, business.region].filter(Boolean).join(', ') } : {}),
    services: project.collections.find((collection) => collection.type === 'SERVICES')?.items.map((item) => String((item.data as { title?: string }).title ?? '')) ?? [],
    goals: business?.primaryConversion ? [business.primaryConversion] : [],
    tonePreferences: business?.tone ? [business.tone] : [],
    answers: {},
    hasLogo: Boolean(project.brandProfile?.logoAssetId),
    logoColors: (project.brandProfile?.tokens as { logoColors?: string[] } | null)?.logoColors ?? [],
    uploadedImageUrls: project.assets.map((asset) => asset.url),
    testimonials:
      testimonialCollection?.items.map((item) => {
        const data = item.data as { quote?: string; author?: string; source?: string }
        return {
          quote: data.quote ?? '',
          author: data.author ?? '',
          ...(data.source ? { source: data.source } : {}),
        }
      }) ?? [],
  }
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

/// Executes the whole generation pipeline. Called by the worker; also callable
/// inline so the product still works on a machine without Redis.
export async function runGeneration(request: GenerationRequest): Promise<{ correlationId: string; websiteVersionId: string }> {
  const correlationId = request.correlationId ?? randomUUID()
  const { projectId } = request
  if (!await canGenerate(projectId, request.contentJobId)) {
    await prisma.project.updateMany({ where: { id: projectId, status: 'GENERATING' }, data: { status: 'DRAFT' } })
    throw new Error('Payment is required before website generation.')
  }
  const provider: AiProvider = createAiProvider({ seed: projectId })

  await prisma.project.update({ where: { id: projectId }, data: { status: ProjectStatus.GENERATING } })

  try {
    const brief = await loadBrief(projectId)
    const imageJob = request.contentJobId ? await prisma.contentJob.findUnique({ where: { id: request.contentJobId } }) : null
    const options = generationOptionsSchema.parse(imageJob?.input ?? {})
    const {imageDirection, contentDirection, mode} = options
    brief.imageDirection = imageDirection
    if (contentDirection.style !== 'auto' || contentDirection.styles?.length || contentDirection.audience || contentDirection.notes) brief.tonePreferences.push(contentDirectionPrompt(contentDirection))
    const presence = await loadPresence(projectId)

    const model = await (async (): Promise<WebsiteModel> => {
      if (mode !== 'full') {
        const saved = await prisma.websiteVersion.findFirstOrThrow({where:{projectId,kind:WebsiteVersionKind.DRAFT},orderBy:{version:'desc'}})
        const retained = websiteModelSchema.parse(saved.model)
        if (!['images','fill-images'].includes(mode)) {
          return runStage<WebsiteModel>(projectId,correlationId,GenerationStage.CONTENT,toJson(options),async()=>{
            let completed = 0
            await prisma.generationJob.updateMany({where:{projectId,correlationId,stage:GenerationStage.CONTENT,status:JobStatus.RUNNING},data:{output:toJson({completed,total:retained.pages.length,unit:'pages'})}})
            for (const page of retained.pages) {
              const result = await rewritePageWithAi(projectId,{model:retained,pageId:page.id,instruction:contentDirectionPrompt(contentDirection)})
              retained.pages[retained.pages.findIndex(entry=>entry.id===page.id)] = result.page
              completed += 1
              await prisma.generationJob.updateMany({where:{projectId,correlationId,stage:GenerationStage.CONTENT,status:JobStatus.RUNNING},data:{output:toJson({completed,total:retained.pages.length,unit:'pages'})}})
            }
            return {output:toJson({model:retained,completed,total:retained.pages.length,unit:'pages'}),result:retained}
          })
        }
        return retained
      }
      const analysis = await runStage<BriefAnalysis>(
        projectId,
        correlationId,
        GenerationStage.ANALYZE_BRIEF,
        toJson(brief),
        async () => {
          if (brief.designReference) {
            const observation = await inspectDesignReference(brief.designReference)
            brief.designReference.observation = observation
            await prisma.project.update({ where: { id: projectId }, data: { designReferenceObservation: toJson(observation) } })
          }
          const { data, usage } = await provider.analyzeBrief(brief)

          await prisma.businessProfile.updateMany({
            where: { projectId },
            data: { missingFacts: data.missingFacts },
          })

          return { output: toJson({ ...data, ...(brief.designReference ? { referenceMessage: brief.designReference.observation?.message } : {}) }), result: data, usage }
        },
      )

      await runStage(projectId, correlationId, GenerationStage.NEXT_QUESTIONS, toJson(analysis), async () => {
        const { data, usage } = await provider.proposeQuestions(brief, analysis)
        return { output: toJson(data), result: data, usage }
      })

      const directions = await runStage<DesignDirections>(
        projectId,
        correlationId,
        GenerationStage.DESIGN_DIRECTIONS,
        toJson(analysis),
        async () => {
          const { data, usage } = await provider.proposeDesignDirections(brief, analysis)
          return { output: toJson(data), result: data, usage }
        },
      )

      const { dna, tokens } = await runStage<{ dna: DesignDna; tokens: DesignTokens }>(
        projectId,
        correlationId,
        GenerationStage.DESIGN_DNA,
        toJson({ selectedDirectionId: request.selectedDirectionId }),
        async () => {
          const chosen =
            directions.options.find((option) => option.id === request.selectedDirectionId) ?? directions.options[0]

          if (!chosen) {
            throw new Error('No design direction was produced')
          }

          const brandProfile = await prisma.brandProfile.findUnique({ where: { projectId } })
          /// A palette the user already accepted always wins over a fresh suggestion.
          const userTokens = brandProfile?.tokens as DesignTokens | null
          const resolvedTokens = userTokens?.palette ? userTokens : chosen.tokens
          const suggestions = paletteAlternatives(resolvedTokens, brief.logoColors)

          await prisma.brandProfile.upsert({
            where: { projectId },
            create: {
              projectId,
              designDna: toJson(chosen.dna),
              tokens: toJson(resolvedTokens),
            },
            update: { designDna: toJson(chosen.dna), tokens: toJson(resolvedTokens) },
          })

          return {
            output: toJson({ dna: chosen.dna, tokens: resolvedTokens, paletteSuggestions: suggestions }),
            result: { dna: chosen.dna, tokens: resolvedTokens },
          }
        },
      )

      const plan = await runStage<SitePlan>(
        projectId,
        correlationId,
        GenerationStage.SITE_PLAN,
        toJson(dna),
        async () => {
          if (brief.templateId) {
            const servicePages = brief.services.slice(0,8).map((service,index) => ({path:`/services/${service.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || `service-${index+1}`}`,title:service,purpose:`Explain the supplied ${service} service and invite enquiries.`,serviceName:service,inMainNav:false,sectionPlan:templatePageComponents(brief.templateId!, '/services/detail').map(id=>({family:getComponent(id)!.family,intent:service}))}))
            const templatePlan: SitePlan = { pages:[{path:'/',title:'Home',purpose:brief.description,inMainNav:true},{path:'/about',title:'About',purpose:'Introduce the business using supplied facts.',inMainNav:true},{path:'/services',title:'Services',purpose:'Explain the services supplied by the business.',inMainNav:true},{path:'/contact',title:'Contact',purpose:'Contact the business and submit an enquiry.',inMainNav:true}].map(page=>({...page,sectionPlan:templatePageComponents(brief.templateId!,page.path).map(id=>({family:getComponent(id)!.family,intent:page.purpose}))})).concat(servicePages),navigation:[{label:'Home',path:'/',children:[]},{label:'About',path:'/about',children:[]},{label:'Services',path:'/services',children:servicePages.map(page=>({label:page.title,path:page.path}))},{label:'Contact',path:'/contact',children:[]}] }
            return {output:toJson(templatePlan),result:templatePlan}
          }
          const { data, usage } = await provider.planSite(brief, analysis, dna)
          return { output: toJson(data), result: data, usage }
        },
      )

      const pages = await runStage<WebsitePage[]>(
        projectId,
        correlationId,
        GenerationStage.CONTENT,
        toJson(plan),
        async () => {
          const checkpoint = await prisma.generationJob.findFirst({where:{projectId,correlationId,stage:GenerationStage.CONTENT},select:{output:true}})
          const saved = (checkpoint?.output as {pages?:WebsitePage[]} | null)?.pages ?? []
          const written: WebsitePage[] = []
          await prisma.generationJob.updateMany({where:{projectId,correlationId,stage:GenerationStage.CONTENT,status:JobStatus.RUNNING},data:{output:toJson({completed:saved.length,total:plan.pages.length,unit:'pages',pages:saved})}})

          for (const plannedPage of plan.pages) {
            const cached = saved.find(page=>page.path===plannedPage.path)
            if (cached) { written.push(cached); continue }
            const { data } = await provider.writePage(brief, analysis, dna, tokens, plannedPage)

            written.push({
              id: plannedPage.path === '/' ? 'home' : plannedPage.path.replace(/\//g, '') || 'home',
              path: plannedPage.path,
              title: plannedPage.title,
              pageType: plannedPage.serviceName ? 'SERVICE' : 'CUSTOM',
              h1: data.h1.trim() || plannedPage.title,
              seo: {
                ...data.seo,
                title: data.seo.title.trim() || `${plannedPage.title} | ${brief.businessName}`,
                description: data.seo.description.trim() || plannedPage.purpose || brief.description.slice(0, 160),
                canonical: data.seo.canonical ?? data.path,
              },
              sections: brief.templateId ? templatePageComponents(brief.templateId, plannedPage.path).map((componentId,index) => data.sections.find(section=>section.componentId===componentId) ?? {id:`layout-unused-${index}`,componentId,componentVersion:'1.0.0',hidden:true,props:initialTemplateProps(componentId)}) : data.sections,
            })
            await prisma.generationJob.updateMany({where:{projectId,correlationId,stage:GenerationStage.CONTENT,status:JobStatus.RUNNING},data:{output:toJson({completed:written.length,total:plan.pages.length,unit:'pages',pages:[...written,...saved.filter(page=>!written.some(done=>done.path===page.path))]})}})
          }

          return { output: toJson({ completed:written.length,total:plan.pages.length,unit:'pages',pageCount: written.length, pages: written }), result: written }
        },
      )

      const composedModel = await runStage<WebsiteModel>(
        projectId,
        correlationId,
        GenerationStage.COMPOSE,
        toJson({ pages: pages.length }),
        async () => {
          const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })

          /// Unknown components and invalid props are rejected here rather than
          /// being rendered: the registry is the only allowed vocabulary.
          const rejected: string[] = []
          const sanitizedPages = (brief.templateId ? pages : applyTestimonials(pages, brief.testimonials)).map((page) => ({
            ...page,
            sections: page.sections.flatMap((section) => {
              const family = getComponent(section.componentId)?.family

              /// Header and footer are global: a page-level copy would render
              /// twice, so any the model adds is dropped.
              if (family === 'HEADER' || family === 'FOOTER') {
                return []
              }

              const validation = validateSectionProps(section.id, section.componentId, section.props)

              if (!validation.ok) {
                rejected.push(`${page.path} ${section.id} (${section.componentId}): ${validation.error.message}`)
                return []
              }

              return [{ ...section, props: validation.props as Record<string, unknown> }]
            }),
          }))

          const emptyPage = sanitizedPages.find((page) => page.sections.length === 0)

          if (emptyPage) {
            throw new Error(
              `Every section of ${emptyPage.path} failed registry validation: ${rejected.join(' | ')}`,
            )
          }

          /// The header CTA must land on a page that exists, so it targets the
          /// booking/contact page when the plan produced one.
          const ctaPage =
            sanitizedPages.find((page) => /contact|book|appointment|quote/i.test(page.path)) ??
            sanitizedPages.find((page) => page.path !== '/')

          const header = dna.navigation === 'transparent-overlay' ? 'HeaderTransparent' : 'HeaderSplitUtility'
          const footer = dna.composition.density === 'dense' ? 'FooterCompact' : 'FooterEditorial'
          const navigation = {
            primaryMenu: plan.navigation.map((item) => ({
              label: item.label, linkType: 'PAGE' as const,
              pageId: sanitizedPages.find((page) => page.path === item.path)?.id,
              newTab: false,
              children: item.children.map((child) => ({ label: child.label, linkType: 'PAGE' as const, pageId: sanitizedPages.find((page) => page.path === child.path)?.id, newTab: false, children: [] })),
            })),
            footerMenu: [],
            utilityMenu: [],
          }

          const composed: WebsiteModel = {
            schemaVersion: WEBSITE_MODEL_SCHEMA_VERSION,
            site: {
              name: brief.businessName,
              locale: project.defaultLocale,
              previewHost: project.previewHost,
            },
            businessProfileRef: projectId,
            designDna: dna,
            tokens,
            navigation,
            globalComponents: {
              header: {
                componentId: header,
                componentVersion: getComponent(header)?.version ?? '1.0.0',
                props: {
                  logoText: brief.businessName,
                  items: navigation.primaryMenu.map((item) => ({
                    label: item.label,
                    href: sanitizedPages.find((page) => page.id === item.pageId)?.path ?? '/',
                    children: item.children.map((child) => ({ label: child.label, href: sanitizedPages.find((page) => page.id === child.pageId)?.path ?? '/' })),
                  })),
                  cta: { label: 'Get in touch', href: ctaPage?.path ?? '/' },
                  sticky: true,
                },
              },
              footer: {
                componentId: footer,
                componentVersion: getComponent(footer)?.version ?? '1.0.0',
                props: {
                  businessName: brief.businessName,
                  tagline: brief.description.slice(0, 90),
                  columns: [
                    {
                      title: 'Pages',
                      items: sanitizedPages.map((page) => ({ label: page.title, href: page.path })),
                    },
                  ],
                  socials: presence.socials.map((social) => ({ platform: social.network, href: social.url })),
                  legalLinks: [],
                },
              },
            },
            pages: sanitizedPages,
            collections: {},
            socials: presence.socials,
            contact: presence.contact,
            google: presence.google,
            schemaSettings: { organizationType: 'LocalBusiness', enabledTypes: ['LocalBusiness'] },
            analyticsSettings: presence.analytics,
            publishSettings: { wwwPreference: 'non-www', robotsAllowIndexing: true },
          }

          const selectedTemplate = getLayoutTemplate(brief.templateId)
          if (selectedTemplate) {
            const items = navigation.primaryMenu.map(item=>({label:item.label,href:sanitizedPages.find(page=>page.id===item.pageId)?.path || '/',children:item.children.map(child=>({label:child.label,href:sanitizedPages.find(page=>page.id===child.pageId)?.path || '/'}))}))
            const chromeInput={businessName:brief.businessName,description:brief.description,email:presence.contact.email,phone:presence.contact.phone,address:presence.contact.addressLine1,items}
            composed.globalComponents.header={componentId:selectedTemplate.header,componentVersion:'1.0.0',props:templateChromeProps(selectedTemplate.header,chromeInput)}
            composed.globalComponents.footer={componentId:selectedTemplate.footer,componentVersion:'1.0.0',props:templateChromeProps(selectedTemplate.footer,chromeInput)}
          }

          // Reject structural problems before spending time generating imagery.
          const base = normalizeSiteHeadings(alignTemplateServiceCards(ensureContactPageLayout(ensureServiceDetailPages(composed))))
          const completed = provider.name === 'openai' ? await enrichServiceDetailPages(projectId,base) : base
          const structure = validateWebsiteModel(completed)
          if (!structure.valid) {
            throw new Error(structure.issues.filter((issue) => issue.level === 'error').map((issue) => issue.message).join('; '))
          }
          const fingerprint = buildFingerprint(completed)

          await prisma.brandProfile.update({
            where: { projectId },
            data: { fingerprint: toJson(fingerprint) },
          })

          return { output: toJson({ fingerprint, model: completed }), result: completed }
        },
      )

    return composedModel
    })()

    const modelWithImages = mode === 'content' ? model : await runStage<WebsiteModel>(
      projectId,
      correlationId,
      GenerationStage.IMAGES,
      toJson({ uploaded: brief.uploadedImageUrls.length }),
      async () => {
        const storage = getStorage()
        const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
        const imageSource = createHash('sha256').update(JSON.stringify(model)).digest('hex')
        const checkpoint = await prisma.generationJob.findFirst({where:{projectId,correlationId,stage:GenerationStage.IMAGES},select:{output:true}})
        const savedImages = checkpoint?.output as { imageSource?:string; model?:unknown; completed?:number; generated?:number } | null
        const resumingImages = Boolean(savedImages?.model) && (savedImages?.imageSource === imageSource || mode === 'full')
        const filled = resumingImages ? websiteModelSchema.parse(savedImages!.model) : structuredClone(model)
        if (mode === 'full') {
          // Reuse the saved brand logo across reruns; an uploaded logo always wins.
          let brand = await prisma.brandProfile.findUnique({ where: { projectId }, include: { logo: true } })
          let logo = brand?.logo
          if (!logo) {
            logo = await prisma.asset.findFirst({
              where: { projectId, kind: AssetKind.LOGO, source: AssetSource.UPLOAD },
              orderBy: { createdAt: 'desc' },
            })
          }
          if (!logo) {
            const prompt = [
              `Create an original, professional business logo for ${JSON.stringify(brief.businessName)}.`,
              `The exact business name is ${JSON.stringify(brief.businessName)}; spell it accurately and include no other text.`,
              `Business context: ${brief.industry ?? brief.description}.`,
              `Use these brand colours: ${JSON.stringify(filled.tokens.palette)}.`,
              'Simple flat design, clear readable lettering, generous margins, suitable for a small website header. No mockup, photo, watermark or extra tagline.',
            ].join(' ')
            const { data: image } = await provider.generateImage(prompt, '16:9', 'brand:logo', brief.businessName)
            const extension = image.contentType === 'image/png' ? 'png' : 'svg'
            const stored = await storage.put(assetKey(project.workspaceId, projectId, `logo.${extension}`), image.data, image.contentType)
            logo = await prisma.asset.create({
              data: {
                workspaceId: project.workspaceId, projectId, kind: AssetKind.LOGO,
                source: AssetSource.AI_GENERATED, storageKey: stored.key, url: stored.url,
                mimeType: stored.contentType, bytes: stored.bytes, altText: brief.businessName, prompt,
              },
            })
          }
          await prisma.brandProfile.upsert({
            where: { projectId },
            create: { projectId, logoAssetId: logo.id },
            update: {},
          })
          // Do not overwrite a logo uploaded while the image request was running.
          await prisma.brandProfile.updateMany({
            where: { projectId, logoAssetId: null }, data: { logoAssetId: logo.id },
          })
          brand = await prisma.brandProfile.findUnique({ where: { projectId }, include: { logo: true } })
          filled.globalComponents.header.props.logoImageUrl = brand?.logo?.url ?? logo.url
          filled.globalComponents.header.props.logoText = brief.businessName
        }
        const generatedUrls = new Set<string>()
        if (['images','content-images'].includes(mode) && !resumingImages) {
          const generatedAssets = await prisma.asset.findMany({where:{projectId,kind:AssetKind.IMAGE,source:AssetSource.AI_GENERATED},select:{url:true}})
          generatedAssets.forEach(asset=>generatedUrls.add(asset.url))
          const clearGenerated = (value: unknown): void => {
            if (!value || typeof value !== 'object') return
            for (const [key, item] of Object.entries(value)) {
              if (typeof item === 'string' && generatedUrls.has(item)) (value as Record<string,unknown>)[key] = ''
              else clearGenerated(item)
            }
          }
          for (const page of filled.pages) for (const section of page.sections) clearGenerated(section.props)
        }
        const slots = collectImageSlots(filled)

        const resolve = (slot: string): Record<string, unknown> | undefined => {
          const [pageId, sectionId] = slot.split(':')
          const page = filled.pages.find((candidate) => candidate.id === pageId)
          const section = page?.sections.find((candidate) => candidate.id === sectionId)

          return section ? (section.props as Record<string, unknown>) : undefined
        }

        /// Images the user uploaded are always preferred over generated ones.
        const uploads = mode === 'full' ? [...brief.uploadedImageUrls] : []
        const pending: ImageSlotRequest[] = []

        for (const slot of slots) {
          const props = resolve(slot.slot)
          const pointer = slot.slot.split(':')[2]

          if (!props || !pointer) {
            continue
          }

          const upload = uploads.shift()

          if (upload) {
            setByPointer(props, pointer, upload)
            continue
          }

          pending.push(slot)
        }

        // Every visible image slot is part of the layout contract. Batch the
        // planning request instead of silently dropping slots after ten images.
        let generated = 0
        const previouslyCompleted = resumingImages ? (savedImages?.completed ?? savedImages?.generated ?? 0) : 0
        const totalImages = previouslyCompleted + pending.length
        await prisma.generationJob.updateMany({where:{projectId,correlationId,stage:GenerationStage.IMAGES,status:JobStatus.RUNNING},data:{output:toJson({imageSource,model:filled,completed:previouslyCompleted,total:totalImages,unit:'images',generated:previouslyCompleted})}})
        for (let offset = 0; offset < pending.length; offset += IMAGE_PLAN_BATCH_SIZE) {
          const planned = pending.slice(offset, offset + IMAGE_PLAN_BATCH_SIZE)
          const { data: plan } = await provider.planImages(brief, filled, planned)
          for (const image of plan.images) {
            const props = resolve(image.slot)
            const [, sectionId, pointer] = image.slot.split(':')

            if (!props || !pointer || !sectionId) {
              continue
            }

            const { data: generatedImage } = await provider.generateImage(
              `${image.prompt}\n${imageDirectionPrompt(imageDirection, brief.location)}`,
              image.aspectRatio,
              image.slot,
              image.alt,
            )
            const extension = generatedImage.contentType === 'image/png' ? 'png' : 'svg'
            const key = assetKey(project.workspaceId, projectId, `${sectionId}-${randomUUID()}.${extension}`)
            const stored = await storage.put(key, generatedImage.data, generatedImage.contentType)

            await prisma.asset.create({
              data: {
                workspaceId: project.workspaceId,
                projectId,
                kind: AssetKind.IMAGE,
                source: AssetSource.AI_GENERATED,
                storageKey: stored.key,
                url: stored.url,
                mimeType: stored.contentType,
                bytes: stored.bytes,
                altText: generatedImage.alt,
                prompt: generatedImage.prompt,
              },
            })

            setByPointer(props, pointer, stored.url)
            generated += 1
            await prisma.generationJob.updateMany({where:{projectId,correlationId,stage:GenerationStage.IMAGES,status:JobStatus.RUNNING},data:{output:toJson({imageSource,model:filled,generated:previouslyCompleted+generated,completed:previouslyCompleted+generated,total:totalImages,unit:'images'})}})
            console.info(`Website images: ${generated}/${pending.length} completed (${sectionId})`)
          }
        }
        const missing = collectImageSlots(filled)
        if (missing.length) throw new Error(`Image generation left ${missing.length} required layout slots empty. Retry the image stage to complete them.`)

        return {
          output: toJson({ completed:totalImages,total:totalImages,unit:'images',imageSource, slots: slots.length, reused: brief.uploadedImageUrls.length, generated, model: filled }),
          result: filled,
        }
      },
    )

    const websiteVersionId = await runStage<string>(
      projectId,
      correlationId,
      GenerationStage.VALIDATE,
      toJson({ model: modelWithImages }),
      async () => {
        const validation = validateWebsiteModel(modelWithImages)

        if (!validation.valid) {
          throw new Error(validation.issues.filter((issue) => issue.level === 'error').map((issue) => issue.message).join('; '))
        }

        const homepage = modelWithImages.pages.find((page) => page.path === '/')
        const [minSections, maxSections] = brief.homepageLength === 'expanded' ? [5, 6] : [3, 4]
        if (mode === 'full' && (!homepage || !brief.templateId && (homepage.sections.length < minSections! || homepage.sections.length > maxSections!))) {
          throw new Error(`Homepage must contain ${minSections}–${maxSections} sections for the selected length`)
        }
        if(mode === 'full' && brief.templateId && homepage!.sections.map(section=>section.componentId).join(',')!==templatePageComponents(brief.templateId,'/').join(','))throw new Error('Generated sections do not match the selected layout.')
        for (const page of modelWithImages.pages.filter((entry) => mode === 'full' && entry.pageType === 'SERVICE')) {
          if (!page.sections.some((section) => typeof section.props.imageUrl === 'string' && section.props.imageUrl.trim())) {
            throw new Error(`Service page ${page.path} is missing its required image`)
          }
        }

        const headingErrors = modelWithImages.pages.flatMap((page) =>
          auditHeadings(page)
            .filter((issue) => issue.level === 'error')
            .map((issue) => `${page.path}: ${issue.message}`),
        )

        if (headingErrors.length > 0) {
          throw new Error(headingErrors.join('; '))
        }

        const review = await provider.reviewSite(modelWithImages)
        const lastVersion = await prisma.websiteVersion.findFirst({
          where: { projectId },
          orderBy: { version: 'desc' },
        })

        const version = await prisma.websiteVersion.create({
          data: {
            projectId,
            version: (lastVersion?.version ?? 0) + 1,
            kind: WebsiteVersionKind.DRAFT,
            model: toJson(modelWithImages),
            schemaVersion: WEBSITE_MODEL_SCHEMA_VERSION,
            note: `AI generation: ${mode}`,
          },
        })

        /// Pages are also written as rows so the editor, routing and SEO tools
        /// can query them without unpacking the whole model JSON.
        await prisma.page.deleteMany({ where: { projectId } })
        await prisma.page.createMany({
          data: modelWithImages.pages.map((page, index) => ({
            projectId,
            title: page.title,
            slug: page.path === '/' ? 'home' : page.path.replace(/^\//, ''),
            path: page.path,
            position: index,
            status: PageStatus.DRAFT,
            indexable: page.seo.index,
            seoTitle: page.seo.title,
            seoDescription: page.seo.description,
            sections: toJson(page.sections),
          })),
        })

        await prisma.project.update({ where: { id: projectId }, data: { status: ProjectStatus.READY } })

        return {
          output: toJson({ issues: validation.issues, review: review.data }),
          result: version.id,
        }
      },
    )

    return { correlationId, websiteVersionId }
  } catch (error) {
    await prisma.project.update({ where: { id: projectId }, data: { status: ProjectStatus.DRAFT } })
    throw error
  }
}

/// Re-runs a single failed stage onwards. Used by the "retry" action in the UI.
export async function retryGeneration(projectId: string, correlationId: string): Promise<void> {
  const contentJob = await prisma.contentJob.findFirst({where:{id:correlationId,projectId},select:{id:true}})
  await runGeneration({ projectId, correlationId, ...(contentJob ? {contentJobId:contentJob.id} : {}) })
}
