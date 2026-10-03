import type { WebsiteSection } from '@awb/website-model'

// Destination is an insertion slot in the original list (0 through length).
export function reorderSections(sections: WebsiteSection[], sourceId: string, slot: number): WebsiteSection[] {
  const from = sections.findIndex((entry) => entry.id === sourceId)
  if (from < 0 || !Number.isInteger(slot) || slot < 0 || slot > sections.length) return sections
  const to = from < slot ? slot - 1 : slot
  if (from === to) return sections
  const next = [...sections]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved!)
  return next
}

export function sectionDropSlot(centres: number[], pointerY: number): number {
  const index = centres.findIndex((centre) => pointerY < centre)
  return index < 0 ? centres.length : index
}
