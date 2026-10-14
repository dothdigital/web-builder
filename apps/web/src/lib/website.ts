import { WebsiteVersionKind, prisma } from '@awb/database'
import { websiteModelSchema, type WebsiteModel } from '@awb/website-model'

export async function loadDraftModel(projectId: string): Promise<WebsiteModel | undefined> {
  const version = await prisma.websiteVersion.findFirst({
    where: { projectId, kind: WebsiteVersionKind.DRAFT },
    orderBy: { version: 'desc' },
  })

  if (!version) {
    return undefined
  }

  const parsed = websiteModelSchema.safeParse(version.model)

  return parsed.success ? parsed.data : undefined
}

export async function saveDraftModel(
  projectId: string,
  model: WebsiteModel,
  note: string,
  staffActorId?: string,
  previewActorId?: string,
): Promise<{ testLinkQueued: boolean }> {
  const last = await prisma.websiteVersion.findFirst({ where: { projectId }, orderBy: { version: 'desc' } })

  /// Every edit produces a new immutable version, so undo and rollback are a
  /// query rather than a diff.
  return prisma.$transaction(async tx => {
  const saved = await tx.websiteVersion.create({
    data: {
      projectId,
      version: (last?.version ?? 0) + 1,
      kind: WebsiteVersionKind.DRAFT,
      model: JSON.parse(JSON.stringify(model)),
      schemaVersion: model.schemaVersion,
      note,
    },
  })
  const queued = previewActorId ? await tx.hostingSite.updateMany({
    where: { projectId, previewHost: { not: null }, previewStatus: { not: 'SUSPENDED' }, billingGateApplied: false },
    data: { previewRequestedVersionId: saved.id, previewRequestedById: previewActorId },
  }) : { count: 0 }
  if (staffActorId) await tx.auditEvent.create({ data: { actorId: staffActorId, projectId, action: 'staff.website.save', targetType: 'WebsiteVersion', targetId: saved.id } })
  return { testLinkQueued: queued.count > 0 }
  })
}
