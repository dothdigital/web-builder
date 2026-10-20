'use client'
import { useMemo, useState } from 'react'
import { reviewEditorContent, type ReviewField } from '@/lib/editor-content-review'
import { repeatedPageImages, type WebsiteModel } from '@awb/website-model'

export function ContentReviewPanel({ model, imageUrls, onEdit }: { model: WebsiteModel; imageUrls: Record<string, string>; onEdit: (field: ReviewField) => void }) {
  const [filter, setFilter] = useState<'empty' | 'images' | 'all'>('empty')
  const [pageId, setPageId] = useState('all')
  const [failed, setFailed] = useState<Record<string, string>>({})
  const fields = useMemo(() => reviewEditorContent(model), [model])
  const repeated = useMemo(() => new Set(repeatedPageImages(model).flatMap(group => group.uses.map(use => `${use.pageId}:${use.sectionId}:${use.pointer}`))), [model])
  const isFailed = (field: ReviewField) => !field.empty && failed[field.id] === (imageUrls[field.value] ?? field.value)
  const visible = fields.filter(field => (pageId === 'all' || field.globalSlot || field.pageId === pageId) && (filter === 'all' || filter === 'images' && field.kind === 'image' || filter === 'empty' && (field.empty || isFailed(field) || repeated.has(field.id))))
  const emptyImages = fields.filter(field => field.kind === 'image' && field.empty).length
  const emptyText = fields.filter(field => field.kind === 'text' && field.empty).length
  return <section className="grid min-w-0 gap-4 p-4" aria-label="Review images and content">
    <div><h2 className="text-sm font-semibold">Review images & content</h2><p className="mt-2 text-xs text-neutral-600">Check every page, add missing images, replace existing images, and edit text. Empty fields may be optional. Save to keep your changes.</p></div>
    <p className="text-xs" role="status">Across website: {emptyImages} empty image {emptyImages === 1 ? 'field' : 'fields'} · {repeated.size} repeated image placements · {emptyText} empty text {emptyText === 1 ? 'field' : 'fields'}</p>
    <label className="grid gap-1 text-xs">Page<select aria-label="Review page" className="min-w-0 w-full rounded border p-2" value={pageId} onChange={event => setPageId(event.target.value)}><option value="all">All pages</option>{model.pages.map(page => <option key={page.id} value={page.id}>{page.title}</option>)}</select></label>
    <label className="grid gap-1 text-xs">Show<select aria-label="Review filter" className="min-w-0 w-full rounded border p-2" value={filter} onChange={event => setFilter(event.target.value as typeof filter)}><option value="empty">Missing, repeated & failed images</option><option value="images">All images</option><option value="all">All images & content</option></select></label>
    <p className="text-xs text-neutral-500">Choose a field to open its editing controls. Images support the project library, upload, or AI generation. Hidden sections and removed elements are excluded.</p>
    {!visible.length && <p className="rounded border border-emerald-200 bg-emerald-50 p-3 text-xs">No fields match this view. Choose All images or All images & content to review existing content.</p>}
    <ul className="grid gap-3">{visible.map(field => <li key={field.id} className="min-w-0 rounded-lg border border-neutral-200 p-3">
      <p className="truncate text-[11px] text-neutral-500">{field.pageTitle} · {field.sectionTitle}</p>
      <h3 className="mt-1 text-xs font-semibold">{field.label}</h3>
      {field.kind === 'image' && !field.empty && <img src={imageUrls[field.value] ?? field.value} alt={field.label} loading="lazy" className="mt-2 h-24 w-full rounded bg-neutral-50 object-contain" onError={() => setFailed(current => ({ ...current, [field.id]: imageUrls[field.value] ?? field.value }))} />}
      <p className="mt-2 line-clamp-3 text-xs text-neutral-600">{field.empty ? 'Not set. Review whether this section needs it.' : isFailed(field) ? 'Image could not load. Open its controls to replace it.' : repeated.has(field.id) ? 'This image repeats on this page. Review or replace it.' : field.kind === 'text' ? field.value : 'Image selected'}</p>
      <button type="button" className="mt-3 rounded border border-sky-300 px-3 py-1.5 text-xs font-medium text-sky-800 hover:bg-sky-50" onClick={() => onEdit(field)}>{field.kind === 'image' ? field.empty ? 'Add image' : 'Review / replace image' : field.empty ? 'Add content' : 'Edit content'}</button>
    </li>)}</ul>
  </section>
}
