import { prisma } from '@awb/database'
import { assetReadUrl } from './asset-read-url'
import type { WebsiteModel } from '@awb/website-model'

// Call only after project authorization. Signed URLs belong to this render,
// never to saved model versions, where they would eventually expire.
export async function resolvePreviewAssets(projectId: string, model: WebsiteModel): Promise<WebsiteModel> {
  const assets = await prisma.asset.findMany({ where: { projectId }, select: { url: true, storageKey: true } })
  const serialized = JSON.stringify(model)
  const urls = new Map(await Promise.all(assets.filter((asset) => serialized.includes(asset.url)).map(async (asset) =>
    [asset.url, await assetReadUrl(asset)] as const,
  )))
  function rewrite(value: unknown): unknown {
    if (typeof value === 'string') return urls.get(value) ?? value
    if (Array.isArray(value)) return value.map(rewrite)
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, rewrite(entry)]))
    return value
  }
  return rewrite(model) as WebsiteModel
}
