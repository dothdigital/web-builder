import { z } from 'zod'
import { emailSocialPlatforms } from './email-social'
export const emailFonts = ['Arial', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Georgia', 'Times New Roman', 'Courier New'] as const
const colour = z.string().regex(/^#[a-f\d]{6}$/i)
export const emailBlockSchema = z.object({
  id: z.string().min(1).max(100), type: z.enum(['heading', 'text', 'image', 'button', 'divider', 'spacer', 'social']),
  socialLinks: z.array(z.object({ platform: z.enum(emailSocialPlatforms), href: z.string().trim().max(2000).default(''), color: colour.nullable().default(null) })).max(emailSocialPlatforms.length).default([]),
  iconSize: z.number().int().min(16).max(64).default(28), iconGap: z.number().int().min(0).max(32).default(12),
  html: z.string().max(20000).default(''), src: z.string().max(2000).default(''), alt: z.string().max(500).default(''), href: z.string().max(2000).default(''),
  label: z.string().max(300).default('Learn more'), font: z.enum(emailFonts).default('Arial'), fontSize: z.number().int().min(10).max(72).default(16),
  color: colour.default('#172333'), background: colour.default('#ffffff'), fill: colour.default('#5a38b8'), align: z.enum(['left', 'center', 'right']).default('left'),
  padding: z.number().int().min(0).max(80).default(20), width: z.number().int().min(10).max(100).default(100),
  radius: z.number().int().min(0).max(80).default(0), height: z.number().int().min(1).max(300).default(24),
})
export const emailDesignSchema = z.object({ version: z.literal(1), mode: z.enum(['visual', 'html']).default('visual'), sourceHtml: z.string().max(150000).default(''), background: colour, contentBackground: colour, width: z.number().int().min(320).max(800), blocks: z.array(emailBlockSchema).min(1).max(100) })
export type EmailBlock = z.infer<typeof emailBlockSchema>
export type EmailDesign = z.infer<typeof emailDesignSchema>
export const escapeEmailHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
export function designFromText(body: string): EmailDesign {
  return { version: 1, mode: 'visual', sourceHtml: '', background: '#edf0f5', contentBackground: '#ffffff', width: 600, blocks: [emailBlockSchema.parse({ id: 'intro', type: 'text', html: body.split(/\n\n/).map(p => `<p>${escapeEmailHtml(p).replace(/\n/g, '<br>')}</p>`).join('') })] }
}
export function emailUrl(value: string, image = false) {
  if (!value) return true
  if (image && /^\/api\/email-images\/[a-f\d-]+\.png$/i.test(value)) return true
  if (image && /^\/uploads\/[a-z\d/_\-.]+$/i.test(value)) return true
  if (!image && /^\{\{(dashboard_url|billing_url|unsubscribe_url)\}\}$/.test(value)) return true
  try { const url = new URL(value); return !url.username && !url.password && (image ? url.protocol === 'https:' : ['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol)) } catch { return false }
}

export function reorderEmailBlocks(blocks: EmailBlock[], source: string, target: string, after = false) {
  if (source === target || !blocks.some(b => b.id === source) || !blocks.some(b => b.id === target)) return blocks
  const moved = blocks.find(b => b.id === source)!
  const remaining = blocks.filter(b => b.id !== source)
  const index = remaining.findIndex(b => b.id === target) + (after ? 1 : 0)
  return [...remaining.slice(0, index), moved, ...remaining.slice(index)]
}
