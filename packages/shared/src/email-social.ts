// Reuse the website editor's social glyphs. Email clients receive PNG versions.
export const emailSocialPlatforms = ['facebook', 'instagram', 'linkedin', 'x', 'youtube', 'tiktok', 'whatsapp'] as const
export type EmailSocialPlatform = typeof emailSocialPlatforms[number]
export const emailSocialNames: Record<EmailSocialPlatform, string> = { facebook: 'Facebook', instagram: 'Instagram', linkedin: 'LinkedIn', x: 'X', youtube: 'YouTube', tiktok: 'TikTok', whatsapp: 'WhatsApp' }
const glyphs: Record<EmailSocialPlatform, string> = {
  facebook: '<path fill="currentColor" d="M14 22v-9h3l.5-4H14V7c0-1.2.4-2 2-2h2V1.4C17.4 1.2 16.2 1 14.8 1 11.6 1 10 3 10 6.6V9H7v4h3v9z"/>',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>',
  linkedin: '<circle cx="5" cy="5" r="1.7" fill="currentColor" stroke="none"/><path d="M5 10v10M10 20V10m0 4c0-5.3 9-5.3 9 0v6" stroke-width="3"/>',
  x: '<path fill="currentColor" stroke="none" d="M18.9 2H22l-6.8 7.8L23.2 22H17l-4.9-7.4L5.6 22H2.4l8.2-9.4L.8 2h6.4l4.4 6.6L18.9 2zm-1.1 18h1.7L6.3 3.9H4.5L17.8 20z"/>',
  youtube: '<rect x="2" y="5" width="20" height="14" rx="4"/><path d="m10 9 5 3-5 3z" fill="currentColor" stroke="none"/>',
  tiktok: '<path d="M14 3v12.5a4.5 4.5 0 1 1-4-4.47M14 3c0 4 3 6 6 6" stroke-width="3"/>',
  whatsapp: '<path d="M20.5 11.5a8.5 8.5 0 0 1-12.8 7.3L3 20l1.2-4.7a8.5 8.5 0 1 1 16.3-3.8Z"/><path d="M8 7c-2 3 3 8 6 8l2-2-3-1-1 1-2-2 1-1-1-3Z" stroke-width="1.4"/>',
}
export function emailSocialSvg(platform: EmailSocialPlatform, color: string) {
  if (!emailSocialPlatforms.includes(platform) || !/^#[a-f\d]{6}$/i.test(color)) throw new Error('Invalid social icon')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24" fill="none" color="${color}" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${glyphs[platform].replaceAll('currentColor', color)}</svg>`
}
export function emailSocialIconUrl(platform: EmailSocialPlatform, color: string) {
  if (!emailSocialPlatforms.includes(platform) || !/^#[a-f\d]{6}$/i.test(color)) throw new Error('Invalid social icon')
  return `/api/email-social-icons/${platform}/${color.slice(1).toLowerCase()}.png`
}
export function emailSocialUrl(href: string) {
  if (!href.trim()) return true
  try { const url = new URL(href); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password } catch { return false }
}
