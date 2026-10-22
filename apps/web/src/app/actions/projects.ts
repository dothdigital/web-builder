'use server'

import { assertWebsiteCapacity } from '@/lib/billing/access'
import { requireWorkspace } from '@/lib/tenancy'
import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { CollectionType, ProjectStatus, WorkspaceRole, prisma } from '@awb/database'
import { createAiProvider } from '@awb/ai'
import { submitContentJob } from '@/lib/content-jobs'
import { slugify } from '@awb/shared'
import { intakeMediaSchema, type IntakeMedia } from '@awb/shared/intake-media'
import { designReferenceSchema, designReferencesSchema } from '@awb/shared/design-reference'
import { isLayoutId } from '@awb/shared/layout-catalogue'
import { designTokensSchema, formatServiceLabel, type DesignTokens } from '@awb/website-model'
import { z } from 'zod'
import { rerunRequestSchema, type RerunRequest } from '@awb/shared/rerun-request'
import { primaryWorkspace, requireProject, requireUser } from '@/lib/tenancy'

const briefSchema = z.object({
  templateId: z.string().refine(value => process.env.NEXT_PUBLIC_ENABLE_LAYOUT_TEMPLATES === 'true' && isLayoutId(value), 'Template selection is temporarily unavailable. Use the default design option.').optional(),
  designReference: designReferenceSchema.optional(),
  designReferences: designReferencesSchema.optional(),
  homepageSections: z.array(z.enum(['About us / Who we are', 'Service areas', 'Our methodology / Approach', 'Why choose us'])).max(4).default([]),
  homepageLength: z.enum(['compact', 'expanded']).default('expanded'),
  businessName: z.string().min(2),
  description: z.string().min(20),
  industry: z.string().optional(),
  city: z.string().optional(),
  serviceAreas: z.array(z.string().trim().min(1)).max(100).optional(),
  region: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  additionalPhones: z.array(z.string().trim().min(1).max(100)).max(19).default([]),
  primaryConversion: z.enum(['CALL', 'WHATSAPP', 'FORM', 'BOOKING_URL', 'QUOTE']).default('FORM'),
  tone: z.string().optional(),
  services: z.array(z.string().transform(formatServiceLabel)).default([]),
  testimonials: z
    .array(z.object({ quote: z.string().min(1), author: z.string().min(1), source: z.string().optional() }))
    .default([]),
})

export type BriefInput = z.input<typeof briefSchema>

export async function createProjectFromBrief(input: BriefInput): Promise<{ projectId: string }> {
  const user = await requireUser()
  const workspace = await primaryWorkspace(user.id)

  if (!workspace) {
    throw new Error('No workspace found for this user')
  }

  const brief = briefSchema.parse(input)
  const phoneNumbers = [...new Set([brief.phone?.trim(), ...brief.additionalPhones].filter((phone): phone is string => Boolean(phone)))]
  const slug = `${slugify(brief.businessName)}-${randomUUID().slice(0, 6)}`

  await requireWorkspace(workspace.id, WorkspaceRole.EDITOR)
  const project = await prisma.$transaction(async tx => {
    await assertWebsiteCapacity(tx, workspace.id)
    return tx.project.create({
    data: {
      workspaceId: workspace.id,
      name: brief.businessName,
      templateId: brief.templateId,
      homepageLength: brief.homepageLength,
      homepageSections: brief.homepageSections,
      ...(brief.designReferences ? { designReference: brief.designReferences } : brief.designReference ? { designReference: brief.designReference } : {}),
      slug,
      previewHost: `${slug}.preview.local`,
      businessProfile: {
        create: {
          displayName: brief.businessName,
          description: brief.description,
          ...(brief.industry ? { industry: brief.industry } : {}),
          ...(brief.city ? { city: brief.city } : {}),
          serviceArea: brief.serviceAreas ?? [],
          phones: phoneNumbers,
          ...(brief.region ? { region: brief.region } : {}),
          ...(brief.email ? { email: brief.email } : {}),
          ...(phoneNumbers[0] ? { phone: phoneNumbers[0] } : {}),
          ...(brief.tone ? { tone: brief.tone } : {}),
          primaryConversion: brief.primaryConversion,
          missingFacts: [],
        },
      },
    },
  })

  })

  /// Services and testimonials live in collections so the user owns them as
  /// data: testimonials in particular are never authored by the AI.
  if (brief.services.length > 0) {
    await prisma.collection.create({
      data: {
        projectId: project.id,
        type: CollectionType.SERVICES,
        name: 'Services',
        items: {
          create: brief.services.map((title, position) => ({ position, data: { title } })),
        },
      },
    })
  }

  if (brief.testimonials.length > 0) {
    await prisma.collection.create({
      data: {
        projectId: project.id,
        type: CollectionType.TESTIMONIALS,
        name: 'Testimonials',
        items: {
          create: brief.testimonials.map((testimonial, position) => ({ position, data: { ...testimonial } })),
        },
      },
    })
  }

  return { projectId: project.id }
}

const presenceSchema = z.object({
  socials: z
    .array(z.object({ network: z.string().min(1), url: z.string().url(), label: z.string().optional() }))
    .default([]),
  googleBusinessUrl: z.string().url().optional().or(z.literal('')),
  googleMapsUrl: z.string().url().optional().or(z.literal('')),
  googlePlaceId: z.string().optional(),
  ga4MeasurementId: z.string().optional(),
  gtmContainerId: z.string().optional(),
  googleVerification: z.string().optional(),
  addressLine1: z.string().optional(),
  city: z.string().trim().optional(),
  region: z.string().trim().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  hours: z
    .array(z.object({ day: z.string(), opens: z.string(), closes: z.string(), closed: z.boolean().default(false) }))
    .default([]),
})

export type PresenceInput = z.input<typeof presenceSchema>

/// Social and Google details are user-supplied facts: they are stored verbatim
/// and handed to the generator, never invented by the model.
export async function saveBusinessPresence(projectId: string, input: PresenceInput): Promise<void> {
  await requireProject(projectId, WorkspaceRole.EDITOR)

  const presence = presenceSchema.parse(input)
  const socials = presence.socials.filter((social) => social.url.trim().length > 0)

  await prisma.socialLink.deleteMany({ where: { projectId } })

  if (socials.length > 0) {
    await prisma.socialLink.createMany({
      data: socials.map((social, position) => ({
        projectId,
        network: social.network,
        url: social.url,
        ...(social.label ? { label: social.label } : {}),
        position,
      })),
    })
  }

  const integration = {
    ...(presence.ga4MeasurementId ? { ga4MeasurementId: presence.ga4MeasurementId } : {}),
    ...(presence.gtmContainerId ? { gtmContainerId: presence.gtmContainerId } : {}),
    ...(presence.googleVerification ? { googleVerification: presence.googleVerification } : {}),
    ...(presence.googleBusinessUrl ? { googleBusinessUrl: presence.googleBusinessUrl } : {}),
    ...(presence.googleMapsUrl ? { googleMapsUrl: presence.googleMapsUrl } : {}),
    ...(presence.googlePlaceId ? { googlePlaceId: presence.googlePlaceId } : {}),
  }

  await prisma.integration.upsert({
    where: { projectId },
    create: { projectId, conversionEvents: [], ...integration },
    update: integration,
  })

  const openHours = presence.hours.filter((entry) => entry.closed || (entry.opens && entry.closes))

  await prisma.businessProfile.update({
    where: { projectId },
    data: {
      ...(presence.city !== undefined ? { city: presence.city || null } : {}),
      ...(presence.region !== undefined ? { region: presence.region || null } : {}),
      ...(presence.addressLine1 ? { addressLine1: presence.addressLine1 } : {}),
      ...(presence.postalCode ? { postalCode: presence.postalCode } : {}),
      ...(presence.country ? { country: presence.country } : {}),
      ...(openHours.length > 0 ? { hours: openHours } : {}),
    },
  })
}

const testimonialsSchema = z.array(z.object({
  quote: z.string().trim().min(1, 'Enter the review text'),
  author: z.string().trim().min(1, 'Enter the reviewer name'),
  source: z.string().trim().optional(),
}))

export async function saveTestimonials(projectId: string, input: z.input<typeof testimonialsSchema>): Promise<void> {
  await requireProject(projectId, WorkspaceRole.EDITOR)
  const testimonials = testimonialsSchema.parse(input)
  const items = testimonials.map((testimonial, position) => ({ position, data: { ...testimonial } }))
  await prisma.collection.upsert({
    where: { projectId_type: { projectId, type: CollectionType.TESTIMONIALS } },
    create: { projectId, type: CollectionType.TESTIMONIALS, name: 'Testimonials', items: { create: items } },
    update: { items: { deleteMany: {}, create: items } },
  })
}

export async function letAiChooseBrandColors(projectId: string, logoColors: string[]): Promise<void> {
  await requireProject(projectId, WorkspaceRole.EDITOR)
  const colors = z.array(z.string().regex(/^#[\da-f]{6}$/i)).max(10).parse(logoColors)
  await prisma.brandProfile.upsert({ where: { projectId }, create: { projectId, tokens: { logoColors: colors }, letAiChoose: true }, update: { tokens: { logoColors: colors }, letAiChoose: true } })
}

export async function saveBrandColors(projectId: string, tokens: DesignTokens, logoColors: string[]): Promise<void> {
  await requireProject(projectId, WorkspaceRole.EDITOR)

  const parsed = designTokensSchema.parse(tokens)

  await prisma.brandProfile.upsert({
    where: { projectId },
    create: { projectId, tokens: { ...parsed, logoColors }, letAiChoose: false },
    update: { tokens: { ...parsed, logoColors }, letAiChoose: false },
  })
}

export async function startGeneration(projectId: string, rawRerun?: RerunRequest): Promise<{ correlationId: string; mode: string }> {
  const { project } = await requireProject(projectId, WorkspaceRole.EDITOR)
  const rerun = rawRerun === undefined ? undefined : rerunRequestSchema.parse(rawRerun)
  const baseVersion = rerun ? await prisma.websiteVersion.findFirst({ where: { projectId, kind: 'DRAFT' }, orderBy: { version: 'desc' }, select: { id: true } }) : null
  if (rerun && rerun.scope !== 'FULL' && !baseVersion) throw new Error('Build this website first, or choose a full website rebuild.')
  if (rerun) {
    const ids = [...rerun.imageAssetIds, ...(rerun.logoAssetId ? [rerun.logoAssetId] : [])]
    const assets = await prisma.asset.findMany({ where: { projectId, source: 'UPLOAD', id: { in: ids } }, select: { id: true, kind: true } })
    if (rerun.imageAssetIds.some(id => !assets.some(asset => asset.id === id && asset.kind === 'IMAGE')) || rerun.logoAssetId && !assets.some(asset => asset.id === rerun.logoAssetId && asset.kind === 'LOGO')) throw new Error('One of your uploads is unavailable. Upload it again.')
  }
  // Validate configuration before reserving the project for a background run.
  createAiProvider()
  const claimed = await prisma.project.updateMany({
    where: { id: projectId, status: { not: ProjectStatus.GENERATING } },
    data: { status: ProjectStatus.GENERATING },
  })
  if (claimed.count === 0) {
    throw new Error('This website is already being generated. Wait for the current run to finish.')
  }

  try {
    const job = await submitContentJob(projectId, 'WEBSITE', rerun ? { rerun, baseVersionId: baseVersion?.id } : {})
    const result = { correlationId: job.jobId, mode: 'queue' }
    revalidatePath('/dashboard')
    revalidatePath(`/projects/${projectId}`)
    return { correlationId: result.correlationId, mode: result.mode }
  } catch (error) {
    await prisma.project.updateMany({
      where: { id: projectId, status: ProjectStatus.GENERATING },
      data: { status: project.status },
    })
    throw error
  }
}

export async function saveIntakeMedia(projectId: string, input: IntakeMedia): Promise<void> {
  await requireProject(projectId, WorkspaceRole.EDITOR)
  const media = intakeMediaSchema.parse(input)
  const assets = await prisma.asset.findMany({ where: { projectId, id: { in: media.photos.map(photo => photo.assetId) }, kind: 'IMAGE', source: 'UPLOAD' } })
  if (media.photos.some(photo => !assets.some(asset => asset.id === photo.assetId))) throw new Error('One of your photos is no longer available. Upload it again.')
  await prisma.$transaction([
    prisma.project.update({ where: { id: projectId }, data: { intakeMedia: media } }),
    ...media.photos.map(photo => prisma.asset.update({ where: { id: photo.assetId }, data: { altText: photo.description } })),
  ])
}
