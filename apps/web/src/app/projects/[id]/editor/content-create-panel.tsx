'use client'
import { useEffect, useRef, useState } from 'react'
import type { WebsiteModel } from '@awb/website-model'
import { AiBlogCover } from './ai-blog-cover'
import { ImageField } from './inspector'
import { createContentWithAi } from '@/app/actions/editor'
import { contentRequestSchema, type ContentRequest } from '@/lib/content-creation'

export function ContentCreatePanel({ projectId, model, onSelect, imageUrls, openRequest = 0, initialKind = 'blog' }: { imageUrls: Record<string, string>; initialKind?: 'page' | 'blog'; openRequest?: number; projectId: string; model: WebsiteModel; onSelect: (id: string) => void }) {
  const panelRef = useRef<HTMLFieldSetElement>(null)
  const [disclosure, setDisclosure] = useState({ request: openRequest, open: openRequest > 0 })
  const open = disclosure.request !== openRequest ? openRequest > 0 : disclosure.open
  const setOpen = (value: boolean) => setDisclosure({ request: openRequest, open: value })
  useEffect(() => { if (openRequest > 0) panelRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }, [openRequest])
  const [brief, setBrief] = useState<ContentRequest>({ coverImageUrl: '', coverImageAlt: '', includeFaq: true, kind: initialKind, topic: '', slug: '', keyword: '', secondaryKeywords: '', audience: '', goal: '', location: '', details: '', internalPaths: [] })
  const [busy, setBusy] = useState(false)
  const [queued, setQueued] = useState(false)
  const [error, setError] = useState('')
  const update = (patch: Partial<ContentRequest>) => setBrief((value) => ({ ...value, ...patch }))
  const field = (key: 'topic' | 'slug' | 'keyword' | 'secondaryKeywords' | 'audience' | 'goal' | 'location', label: string, placeholder: string) => <label className="grid gap-1">{label}<input className="rounded border p-2" value={brief[key]} placeholder={placeholder} maxLength={key === 'slug' ? 100 : 500} onChange={(event) => update({ [key]: event.target.value, ...(key === 'topic' && (!brief.slug || brief.slug === brief.topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')) ? { slug: event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100) } : {}) })} /></label>
  return <fieldset ref={panelRef} className="grid gap-3 rounded-lg border border-violet-200 bg-violet-50 p-3 text-xs">
    <legend className="px-1 text-sm font-semibold">Blogs & new pages</legend>
    <button type="button" className="rounded bg-violet-700 p-2 text-white" onClick={() => setOpen(!open)}>{open ? 'Close creation form' : '+ Create blog or page with AI'}</button>
    {model.pages.some((page) => page.pageType === 'BLOG_POST') && <div><p className="mb-1 font-medium">Your blog posts</p>{model.pages.filter((page) => ['BLOG_POST', 'BLOG_INDEX'].includes(page.pageType)).map((page) => <button key={page.id} type="button" className="block py-1 text-left text-violet-800 underline" onClick={() => onSelect(page.id)}>{page.title}</button>)}</div>}
    {open && <>
      <fieldset disabled={busy} className="grid gap-3 disabled:opacity-60">
        <label className="grid gap-1">Create<select className="rounded border p-2" value={brief.kind} onChange={(event) => update({ kind: event.target.value as ContentRequest['kind'] })}><option value="blog">Blog post + automatic listing</option><option value="page">New website page</option></select></label>
        {field('topic', 'Topic / working title', 'What should this content cover?')}
        {brief.kind === 'blog' && <div className="grid gap-2"><p className="font-medium">Blog cover image (required)</p><p>The same image appears above the article and on its blog listing card.</p><AiBlogCover projectId={projectId} topic={brief.topic} keyword={brief.keyword} details={brief.details} onUse={(coverImageUrl, coverImageAlt) => update({ coverImageUrl, coverImageAlt })} /><ImageField projectId={projectId} imageUrls={{ ...imageUrls, ...(brief.coverImageUrl ? { [brief.coverImageUrl]: `/api/projects/${projectId}/editor-image?thumbnail=1&url=${encodeURIComponent(brief.coverImageUrl)}` } : {}) }} value={brief.coverImageUrl} onChange={(coverImageUrl) => update({ coverImageUrl })} /><label className="grid gap-1">Image description (alt text)<input className="rounded border p-2" maxLength={300} value={brief.coverImageAlt} onChange={(event) => update({ coverImageAlt: event.target.value })} placeholder="Describe what the image shows" /></label></div>}
        {field('slug', `URL: ${brief.kind === 'blog' ? '/blog/' : '/'}`, 'lowercase-words-with-hyphens')}
        {field('keyword', 'Primary keyword', 'Main phrase people search for')}
        {field('secondaryKeywords', 'Related keywords (optional)', 'Related topics, separated by commas')}
        {field('audience', 'Target audience', 'Who is this for?')}
        {field('goal', 'Purpose / desired action', 'Educate, request a quote, book a consultation…')}
        <label className="flex items-center gap-2"><input type="checkbox" checked={brief.includeFaq} onChange={(event) => update({ includeFaq: event.target.checked })} />Include AI-written FAQs for this page</label>
        {field('location', 'Target location (optional)', 'City, region, country, or global')}
        <label className="grid gap-1">Brief and verified facts<textarea className="rounded border p-2" rows={5} maxLength={8000} value={brief.details} onChange={(event) => update({ details: event.target.value })} placeholder="Key points, services, expertise and facts to include. At least 20 characters." /></label>
        <div><p className="font-medium">Pages to link to (leave unchecked for AI to choose)</p><div className="max-h-40 overflow-auto">{model.pages.map((page) => <label key={page.id} className="flex gap-2 py-1"><input type="checkbox" checked={brief.internalPaths.includes(page.path)} onChange={(event) => update({ internalPaths: event.target.checked ? [...brief.internalPaths, page.path] : brief.internalPaths.filter((path) => path !== page.path) })} />{page.title} ({page.path})</label>)}</div></div>
        <p>AI creates headings, copy, SEO title and description, and contextual links. Review for accuracy before publishing. New content stays in your website draft.</p>
        <button type="button" className="rounded bg-violet-700 p-2 text-white" onClick={async () => {
          if (brief.kind === 'blog' && !brief.coverImageUrl) { setError('Choose or upload a cover image first.'); return }
          const parsed = contentRequestSchema.safeParse(brief)
          if (!parsed.success) { setError(parsed.error.issues.map((issue) => `${issue.path.join(' ')}: ${issue.message}`).join('; ')); return }
          setBusy(true); setError('')
          try { await createContentWithAi(projectId, { model, request: parsed.data }); setQueued(true); window.dispatchEvent(new Event('awb-content-queued')) }
          catch (failure) { setError(failure instanceof Error ? failure.message : 'Generation failed. Please retry.') }
          finally { setBusy(false) }
        }}>{busy ? 'Queuing…' : 'Generate in background'}</button>
      </fieldset>
      {queued && <p role="status">Queued. You can keep working or close this page. Review the result in the notification at the top when it is ready.</p>}
      {error && <p role="alert" className="text-red-700">{error}</p>}
    </>}
  </fieldset>
}
