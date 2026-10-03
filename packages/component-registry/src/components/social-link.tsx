import type { ReactNode } from 'react'

function socialBrand(platform: string, href: string): { name: string; icon: ReactNode } {
  let host = ''
  try { host = new URL(href).hostname.replace(/^www\./, '').toLowerCase() } catch { /* Keep label-based fallback. */ }
  const label = platform.trim().toLowerCase()
  // An explicitly chosen platform determines the icon, even while its URL is being edited.
  if (['facebook', 'instagram', 'linkedin', 'x', 'twitter', 'youtube', 'tiktok', 'whatsapp'].includes(label)) host = ''
  const matches = (name: string, domain = `${name}.com`) => label === name || host === domain || host.endsWith(`.${domain}`)
  if (matches('facebook') || host === 'fb.me' || matches('facebook', 'fb.com')) return { name: 'Facebook', icon: <path fill="currentColor" d="M14 22v-9h3l.5-4H14V7c0-1.2.4-2 2-2h2V1.4C17.4 1.2 16.2 1 14.8 1 11.6 1 10 3 10 6.6V9H7v4h3v9z" /> }
  if (matches('instagram')) return { name: 'Instagram', icon: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></> }
  if (matches('linkedin')) return { name: 'LinkedIn', icon: <><circle cx="5" cy="5" r="1.7" fill="currentColor" stroke="none" /><path d="M5 10v10M10 20V10m0 4c0-5.3 9-5.3 9 0v6" strokeWidth="3" /></> }
  if (matches('x') || matches('twitter')) return { name: 'X', icon: <path fill="currentColor" stroke="none" d="M18.9 2H22l-6.8 7.8L23.2 22H17l-4.9-7.4L5.6 22H2.4l8.2-9.4L.8 2h6.4l4.4 6.6L18.9 2zm-1.1 18h1.7L6.3 3.9H4.5L17.8 20z" /> }
  if (matches('youtube') || host === 'youtu.be') return { name: 'YouTube', icon: <><rect x="2" y="5" width="20" height="14" rx="4" /><path d="m10 9 5 3-5 3z" fill="currentColor" stroke="none" /></> }
  if (matches('tiktok')) return { name: 'TikTok', icon: <path d="M14 3v12.5a4.5 4.5 0 1 1-4-4.47M14 3c0 4 3 6 6 6" strokeWidth="3" /> }
  if (matches('whatsapp') || host === 'wa.me') return { name: 'WhatsApp', icon: <><path d="M20.5 11.5a8.5 8.5 0 0 1-12.8 7.3L3 20l1.2-4.7a8.5 8.5 0 1 1 16.3-3.8Z" /><path d="M8 7c-2 3 3 8 6 8l2-2-3-1-1 1-2-2 1-1-1-3Z" strokeWidth="1.4" /></> }
  return { name: platform || 'Social profile', icon: <><path d="m10 13 4-4M8 16l-1 1a3.5 3.5 0 0 1-5-5l4-4a3.5 3.5 0 0 1 5 0m2 8a3.5 3.5 0 0 0 5 0l4-4a3.5 3.5 0 0 0-5-5l-1 1" /></> }
}

export function SocialLink({ platform, href }: { platform: string; href: string }) {
  if (!href.trim()) return null
  const brand = socialBrand(platform, href)
  return (
    <a href={href} aria-label={brand.name} title={brand.name} style={{ color: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '44px', height: '44px', flexShrink: 0, border: '1px solid currentColor', background: 'color-mix(in srgb, currentColor 8%, transparent)', borderRadius: '50%', textDecoration: 'none' }}>
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{brand.icon}</svg>
    </a>
  )
}

// Deduplicate repeated profiles within a platform, never across distinct platforms.
export function uniqueSocialLinks<T extends { href: string; platform?: string }>(links: T[]): T[] {
  const seen = new Set<string>()
  return links.filter((link) => {
    let key = link.href.trim()
    if (!key) return false
    try { key = new URL(key).href } catch { /* Preserve non-URL values for existing validation. */ }
    key = `${(link.platform ?? '').trim().toLowerCase()}:${key}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
