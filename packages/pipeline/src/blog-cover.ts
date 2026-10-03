import { prisma } from '@awb/database'
import { createAiProvider } from '@awb/ai'
import { assetKey, getStorage } from '@awb/shared'
import { blogCoverPrompt, blogCoverRequestSchema } from './content-creation'

export async function generateBlogCover(projectId: string, raw: unknown, jobId: string) {
  const request = blogCoverRequestSchema.parse(raw)
  const existing = await prisma.asset.findUnique({ where: { id: jobId } })
  if (existing && existing.projectId === projectId) return { url: existing.url, alt: existing.altText ?? request.topic }
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { workspaceId: true } })
  const provider = createAiProvider()
  if (provider.name !== 'openai') throw new Error('Blog cover generation requires OpenAI.')
  const prompt = blogCoverPrompt(request)
  const { data: image } = await provider.generateImage(prompt, '16:9', 'blog:cover', request.topic)
  const extension = image.contentType === 'image/png' ? 'png' : image.contentType === 'image/webp' ? 'webp' : 'jpg'
  const stored = await getStorage().put(assetKey(project.workspaceId, projectId, `blog-cover.${extension}`), image.data, image.contentType)
  const asset = await prisma.asset.upsert({ where: { id: jobId }, update: {}, create: {
    id: jobId, projectId, workspaceId: project.workspaceId, kind: 'IMAGE', source: 'AI_GENERATED',
    storageKey: stored.key, url: stored.url, mimeType: stored.contentType, bytes: stored.bytes,
    altText: image.alt, prompt,
  } })
  return { url: asset.url, alt: asset.altText ?? request.topic }
}
