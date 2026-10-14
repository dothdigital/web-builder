'use client'
import { ErrorNotice } from '@/components/error-notice'
import { useEffect, useId, useRef, useState } from 'react'
import type { WebsiteModel } from '@awb/website-model'
import { createContentWithAi } from '@/app/actions/editor'
import { contentRequestSchema, type ContentRequest } from '@/lib/content-creation'

export function ContentCreatePanel({ projectId, model, onSelect, openRequest = 0, initialKind = 'blog', dialogOnly = false }: { dialogOnly?: boolean; imageUrls: Record<string, string>; initialKind?: 'page' | 'blog'; openRequest?: number; projectId: string; model: WebsiteModel; onSelect: (id: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useId()
  const [disclosure, setDisclosure] = useState({ request: openRequest, open: openRequest > 0 })
  const open = disclosure.request !== openRequest ? openRequest > 0 : disclosure.open
  const setOpen = (value: boolean) => setDisclosure({ request: openRequest, open: value })
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal()
    if (!open && dialog.current?.open) dialog.current.close()
  }, [open])
  const [brief, setBrief] = useState<ContentRequest>({ includeCoverImage: false, imageSubject: '', imageStyle: '', coverImageUrl: '', coverImageAlt: '', includeFaq: true, kind: initialKind, topic: '', slug: '', keyword: '', secondaryKeywords: '', audience: '', goal: '', location: '', details: '', internalPaths: [] })
  const [busy, setBusy] = useState(false)
  const [queued, setQueued] = useState(false)
  const [error, setError] = useState('')
  const update = (patch: Partial<ContentRequest>) => setBrief((value) => ({ ...value, ...patch }))
  const field = (key: 'topic' | 'slug' | 'keyword' | 'secondaryKeywords' | 'audience' | 'goal' | 'location', label: string, placeholder: string) => <label className="grid gap-1">{label}<input className="rounded border p-2" value={brief[key]} placeholder={placeholder} maxLength={key === 'slug' ? 100 : 500} onChange={(event) => update({ [key]: event.target.value, ...(key === 'topic' && (!brief.slug || brief.slug === brief.topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')) ? { slug: event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100) } : {}) })} /></label>
  return <fieldset className={dialogOnly ? "contents" : "grid gap-3 rounded-lg border border-violet-200 bg-violet-50 p-3 text-xs"}>
    {!dialogOnly && <>
    <legend className="px-1 text-sm font-semibold">Blogs & new pages</legend>
    <button type="button" className="rounded bg-violet-700 p-2 text-white" onClick={() => setOpen(!open)}>{open ? 'Close creation form' : '+ Create blog or page with AI'}</button>
    {model.pages.some((page) => page.pageType === 'BLOG_POST') && <div><p className="mb-1 font-medium">Your blog posts</p>{model.pages.filter((page) => ['BLOG_POST', 'BLOG_INDEX'].includes(page.pageType)).map((page) => <button key={page.id} type="button" className="block py-1 text-left text-violet-800 underline" onClick={() => onSelect(page.id)}>{page.title}</button>)}</div>}
    </>}
    <dialog ref={dialog} aria-labelledby={heading} onClose={() => setOpen(false)} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close() }} className="m-auto w-[calc(100%_-_2rem)] max-w-5xl max-h-[90dvh] overflow-hidden rounded-2xl border border-violet-200 bg-white p-0 text-sm text-neutral-900 shadow-2xl backdrop:bg-black/50">
      <div className="flex max-h-[90dvh] flex-col" onClick={event => event.stopPropagation()}>
      <div className="flex shrink-0 items-center justify-between gap-4 border-b bg-violet-50 px-5 py-4"><h2 id={heading} className="text-lg font-semibold">Create a blog or website page</h2><button type="button" aria-label="Close creation form" className="rounded px-2 py-1 text-xl hover:bg-violet-100" onClick={() => dialog.current?.close()}>×</button></div>
      <div className="min-h-0 overflow-y-auto p-5">
      <fieldset disabled={busy} className="grid gap-4 md:grid-cols-2 disabled:opacity-60 [&_input]:min-w-0 [&_select]:min-w-0">
        <div className="grid content-start gap-3">
        <label className="grid gap-1">Create<select className="rounded border p-2" value={brief.kind} onChange={(event) => update({ kind: event.target.value as ContentRequest['kind'] })}><option value="blog">Blog post + automatic listing</option><option value="page">New website page</option></select></label>
        {field('topic', 'Topic / working title', 'What should this content cover?')}
        {field('slug', `URL: ${brief.kind === 'blog' ? '/blog/' : '/'}`, 'lowercase-words-with-hyphens')}
        {field('keyword', 'Primary keyword', 'Main phrase people search for')}
        {field('secondaryKeywords', 'Related keywords (optional)', 'Related topics, separated by commas')}
        {field('audience', 'Target audience', 'Who is this for?')}
        {field('goal', 'Purpose / desired action', 'Educate, request a quote, book a consultation…')}
        <label className="flex items-center gap-2"><input type="checkbox" checked={brief.includeFaq} onChange={(event) => update({ includeFaq: event.target.checked })} />Include AI-written FAQs for this page</label>
        {field('location', 'Target location (optional)', 'City, region, country, or global')}
        </div>
        <div className="grid content-start gap-3">
        <div className="grid gap-3 rounded-lg border bg-neutral-50 p-3">
          <label className="flex items-center gap-2 font-medium"><input type="checkbox" checked={brief.includeCoverImage} onChange={event => update({ includeCoverImage: event.target.checked, coverImageUrl: '', coverImageAlt: '' })} />{brief.kind === 'blog' ? 'Add an AI-generated blog cover' : 'Add an AI-generated page cover'}</label>
          {brief.includeCoverImage ? <>
            <p className="text-xs text-neutral-600">Answer both image questions. Your cover and content are generated together in the background and added to the same draft.</p>
            <label className="grid gap-1">What should the cover image show? (required)<textarea required minLength={10} rows={3} maxLength={1000} className="rounded border p-2" value={brief.imageSubject} onChange={event => update({ imageSubject: event.target.value })} placeholder="Describe the subject, setting and any details to include." /></label>
            <label className="grid gap-1">What visual style should it use? (required)<input required minLength={3} maxLength={500} className="rounded border p-2" value={brief.imageStyle} onChange={event => update({ imageStyle: event.target.value })} placeholder="For example: natural photography, or a blue and gold illustration" /></label>
          </> : <p className="text-xs text-neutral-600">Create content without a cover. You can add one later using AI or upload your own in the page editor.</p>}
        </div>
        <label className="grid gap-1">Brief and verified facts<textarea className="rounded border p-2" rows={5} maxLength={8000} value={brief.details} onChange={(event) => update({ details: event.target.value })} placeholder="Key points, services, expertise and facts to include. At least 20 characters." /></label>
        <div><p className="font-medium">Pages to link to (leave unchecked for AI to choose)</p><div className="max-h-40 overflow-auto">{model.pages.map((page) => <label key={page.id} className="flex gap-2 py-1"><input type="checkbox" checked={brief.internalPaths.includes(page.path)} onChange={(event) => update({ internalPaths: event.target.checked ? [...brief.internalPaths, page.path] : brief.internalPaths.filter((path) => path !== page.path) })} />{page.title} ({page.path})</label>)}</div></div>
        </div>
      </fieldset>
      </div>
      <div className="grid shrink-0 gap-2 border-t bg-white px-5 py-4">
        <p className="text-xs text-neutral-600">AI creates headings, copy, SEO and links. Review for accuracy before publishing. New content stays in your draft.</p>
        <button type="button" disabled={busy} className="rounded bg-violet-700 p-2 text-white disabled:opacity-60" onClick={async () => {
          const parsed = contentRequestSchema.safeParse(brief)
          if (!parsed.success) { setError(parsed.error.issues.map((issue) => `${issue.path.join(' ')}: ${issue.message}`).join('; ')); return }
          setBusy(true); setError('')
          try { await createContentWithAi(projectId, { model, request: parsed.data }); setQueued(true); window.dispatchEvent(new Event('awb-content-queued')) }
          catch (failure) { setError(failure instanceof Error ? failure.message : 'Generation failed. Please retry.') }
          finally { setBusy(false) }
        }}>{busy ? 'Queuing…' : brief.includeCoverImage ? 'Generate content and cover' : 'Generate content'}</button>
      {queued && <p role="status">Queued. Content and any requested cover will be ready together. You can keep working; review the draft in the notification at the top when it is ready.</p>}
      {error && <ErrorNotice code="WT-CONTENT-001" message={error} className="text-red-700" />}
      </div>
      </div>
    </dialog>
  </fieldset>
}
