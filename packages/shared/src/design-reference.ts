import { z } from 'zod'

export function normalizeReferenceUrl(value: string): string {
  const input = value.trim()
  const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(input) ? input : `https://${input}`)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || (url.port && !['80', '443'].includes(url.port))) throw new Error('Enter a public HTTP or HTTPS website address')
  if (!url.hostname.includes('.') || /(^|\.)(localhost|local|internal|test|invalid|example)$/.test(url.hostname)) throw new Error('Enter a public website address')
  url.hash = ''
  return url.href
}

export const designReferenceSchema = z.object({
  url: z.string().trim().max(2000).transform((value, context) => {
    try { return normalizeReferenceUrl(value) } catch { context.addIssue({ code: 'custom', message: 'Enter a public website URL, for example https://www.kinexmedia.com' }); return z.NEVER }
  }),
  mode: z.enum(['layout', 'style', 'both']).default('both'),
  notes: z.string().trim().max(1500).default(''),
})
export type DesignReference = z.infer<typeof designReferenceSchema>
export interface ReferenceObservation {
  status: 'read' | 'unavailable'
  message: string
  structure?: { headings: string[]; sections: number; articles: number; images: number; navigationLinks: number; layoutHints: string[] }
  style?: { colors: string[]; fonts: string[] }
}
