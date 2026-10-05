import { getStorage } from '@awb/shared'

// Saved URLs record where an asset was uploaded. Enabling S3 later must not
// redirect existing local files to a bucket that never received them.
export async function assetReadUrl(asset: { url: string; storageKey: string }): Promise<string> {
  if (asset.url.startsWith('/uploads/')) return asset.url
  return getStorage().readUrl(asset.storageKey)
}
