import { emptyImagePointers, getComponent } from '@awb/component-registry'
import type { ImageSlotRequest } from '@awb/ai'
import type { WebsiteModel } from '@awb/website-model'
import { getAtPointer, setAtPointer } from './json-pointer'

// Discover replacement slots without clearing images in the saved website.
export function replacementImageSlots(model: WebsiteModel): ImageSlotRequest[] {
  return model.pages.flatMap(page => page.sections.flatMap(section => {
    const definition = getComponent(section.componentId)
    if (section.hidden || !definition || ['HEADER', 'FOOTER'].includes(definition.family)) return []
    const cleared = structuredClone(section.props)
    for (const field of definition.editorFields) {
      if (field.path === '/sectionBackgroundImageUrl') continue
      const key = field.path.replace(/^\//, '')
      if (field.type === 'image') cleared[key] = ''
      if (['list', 'collection'].includes(field.type) && Array.isArray(cleared[key])) {
        for (const item of cleared[key] as Array<Record<string, unknown>>) {
          if (!item || typeof item !== 'object') continue
          if ('imageUrl' in item || definition.family === 'SERVICES' && field.path === '/items') item.imageUrl = ''
          if ('url' in item || 'alt' in item) item.url = ''
        }
      }
    }
    return emptyImagePointers(section.componentId, cleared).map(pointer => ({
      slot: `${page.id}:${section.id}:${pointer}`,
      pageTitle: page.title, componentId: section.componentId, family: definition.family,
      subjectContext: JSON.stringify({ section: section.props, imageOwner: getAtPointer(section.props, pointer.split('/').slice(0, -1).join('/')) }),
      ...(typeof section.props.heading === 'string' ? { heading: section.props.heading } : {}),
    }))
  }))
}

export function replaceScopedImage(model: WebsiteModel, slot: string, url: string, alt: string): WebsiteModel {
  const [pageId, sectionId, pointer] = slot.split(':')
  const pageIndex = model.pages.findIndex(page => page.id === pageId)
  const sectionIndex = model.pages[pageIndex]?.sections.findIndex(section => section.id === sectionId) ?? -1
  if (pageIndex < 0 || sectionIndex < 0 || !pointer) throw new Error('Invalid image replacement slot')
  const base = `/pages/${pageIndex}/sections/${sectionIndex}/props`
  let next = setAtPointer(model, base + pointer, url)
  const altPointer = pointer.endsWith('/imageUrl') ? pointer.replace(/\/imageUrl$/, '/imageAlt') : pointer.endsWith('/url') ? pointer.replace(/\/url$/, '/alt') : undefined
  if (altPointer) next = setAtPointer(next, base + altPointer, alt)
  return next
}
