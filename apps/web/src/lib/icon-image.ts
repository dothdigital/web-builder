import license from './icons/license.json'
export type LibraryIcon = { nodes: Array<[string, Record<string, string | number>]>; tags: string[] }
const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
export function iconImage(icon: LibraryIcon, color: string, size: number) {
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error('Choose a valid icon color.')
  if (!Number.isInteger(size) || size < 16 || size > 256) throw new Error('Choose an icon size between 16 and 256 pixels.')
  const shapes = icon.nodes.map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([key,value]) => `${key}="${escape(String(value))}"`).join(' ')} />`).join('')
  const svg = `<svg data-awb-icon="lucide" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><!--${license.replace(/--/g, '—')}-->${shapes}</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
