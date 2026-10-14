import { z } from 'zod'

export function videoSource(value: string): { kind: 'embed' | 'file'; url: string } | undefined {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password) return
    const host = url.hostname.toLowerCase()
    if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(host)) {
      const id = host === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v') ?? url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)$/)?.[1]
      if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) return { kind: 'embed', url: `https://www.youtube-nocookie.com/embed/${id}` }
    }
    if (['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(host)) {
      const match = url.pathname.match(/^\/(?:video\/)?(\d+)(?:\/([a-zA-Z0-9]+))?$/)
      if (match) {
        const hash = match[2] ?? url.searchParams.get('h')
        if (hash && !/^[a-zA-Z0-9]+$/.test(hash)) return
        return { kind: 'embed', url: `https://player.vimeo.com/video/${match[1]}${hash ? `?h=${hash}` : ''}` }
      }
    }
    if (/\.(mp4|webm)$/i.test(url.pathname)) return { kind: 'file', url: url.href }
  } catch { /* An unsupported URL has no playable source. */ }
}

export const videoLinkSchema = z.string().trim().max(2048).refine(value => Boolean(videoSource(value)), 'Use an HTTPS YouTube, Vimeo, MP4 or WebM video link.')
export const intakeMediaSchema = z.object({
  imageMode: z.enum(['upload', 'generate', 'mixed']).default('mixed'),
  photos: z.array(z.object({
    assetId: z.string().min(1),
    purpose: z.enum(['personal', 'product', 'work', 'other']).default('other'),
    description: z.string().trim().max(300).default(''),
  })).max(30).default([]),
  videos: z.array(z.object({ url: videoLinkSchema, title: z.string().trim().min(1).max(120) })).max(5).default([]),
}).superRefine((value, ctx) => {
  if (value.imageMode === 'upload' && !value.photos.length) ctx.addIssue({ code: 'custom', path: ['photos'], message: 'Upload at least one photo, or choose AI images.' })
})
export type IntakeMedia = z.infer<typeof intakeMediaSchema>
