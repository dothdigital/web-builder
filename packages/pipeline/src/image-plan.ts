import type { ImageSlotRequest } from '@awb/ai'

const optionGroup = (slot: ImageSlotRequest) => /:\/items\/\d+\/imageUrl$/.test(slot.slot)
  ? slot.slot.replace(/:\/items\/\d+\/imageUrl$/, '') : undefined

/** Give pages coverage, then complete sibling option sets before decorative extras. */
export function prioritizeImageSlots(slots: ImageSlotRequest[], allowance: number): ImageSlotRequest[] {
  const firstByPage = new Map<string, ImageSlotRequest>()
  const groups = new Map<string, ImageSlotRequest[]>()
  for (const slot of slots) {
    const pageId = slot.slot.split(':')[0]!
    if (!firstByPage.has(pageId)) firstByPage.set(pageId, slot)
    const group = optionGroup(slot)
    if (group) groups.set(group, [...(groups.get(group) ?? []), slot])
  }
  const chosen = new Set(firstByPage.values())
  // A complete homepage needs its main section images as well as its hero.
  // Give these required images the same coverage guarantee as inner-page heroes.
  for (const slot of slots) {
    if (slot.slot.split(':')[0] === 'home' && slot.slot.endsWith(':/imageUrl') && ['ABOUT', 'CONTACT'].includes(slot.family)) chosen.add(slot)
  }
  const limit = Math.max(chosen.size, Number.isFinite(allowance) ? Math.max(0, Math.floor(allowance)) : 10)
  const siblings = [...groups.values()].filter(group => group.length > 1)
    .sort((a, b) => Number(b.some(slot => chosen.has(slot))) - Number(a.some(slot => chosen.has(slot))))
  const grouped = new Set(siblings.flat())
  for (const group of siblings) {
    const missing = group.filter(slot => !chosen.has(slot))
    if (chosen.size + missing.length <= limit) missing.forEach(slot => chosen.add(slot))
  }
  for (const slot of slots) {
    if (chosen.size >= limit) break
    if (!grouped.has(slot)) chosen.add(slot)
  }
  return [...chosen]
}
