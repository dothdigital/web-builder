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
): Promise<void> {
  const last = await prisma.websiteVersion.findFirst({ where: { projectId }, orderBy: { version: 'desc' } })

  /// Every edit produces a new immutable version, so undo and rollback are a
  /// query rather than a diff.
  await prisma.websiteVersion.create({
    data: {
      projectId,
      version: (last?.version ?? 0) + 1,
      kind: WebsiteVersionKind.DRAFT,
      model: JSON.parse(JSON.stringify(model)),
      schemaVersion: model.schemaVersion,
      note,
    },
  })
}
