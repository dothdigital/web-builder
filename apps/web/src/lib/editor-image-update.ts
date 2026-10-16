import { createContext } from 'react'
import { editorImageTargetSchema, type EditorImageTarget } from '@awb/shared/image-direction'
import type { WebsiteModel } from '@awb/website-model'
import { getAtPointer, setAtPointer } from './json-pointer'
export const EditorImageTargetContext = createContext<((pointer: string, originalUrl: string) => EditorImageTarget | undefined) | undefined>(undefined)

export function applyEditorImage(model: WebsiteModel, raw: unknown, image: { url: string; alt: string }): WebsiteModel {
 const target = editorImageTargetSchema.parse(raw)
 if (!image.url || typeof image.url !== 'string') throw new Error('The generated image is unavailable.')
 const pageIndex = model.pages.findIndex(page => page.id === target.pageId)
 const sectionIndex = model.pages[pageIndex]?.sections.findIndex(section => section.id === target.sectionId) ?? -1
 if (!target.globalSlot && (pageIndex < 0 || sectionIndex < 0)) throw new Error('The image destination was removed. No other image was changed.')
 const root = target.globalSlot ? `/globalComponents/${target.globalSlot}/props` : `/pages/${pageIndex}/sections/${sectionIndex}/props`
 const current = getAtPointer(model, root + target.pointer)
 if (current === image.url) return model
 if (typeof current !== 'string' || current !== target.originalUrl) throw new Error('That image changed while AI was working. It has been kept; generate again for the updated image.')
 let next = setAtPointer(model, root + target.pointer, image.url)
 const alt = target.pointer.endsWith('/imageUrl') ? target.pointer.replace(/\/imageUrl$/, '/imageAlt') : target.pointer.endsWith('/url') ? target.pointer.replace(/\/url$/, '/alt') : undefined
 if (alt) next = setAtPointer(next, root + alt, image.alt)
 return next
}
