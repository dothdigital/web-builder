'use client'

import type { WebsitePage } from '@awb/website-model'
import { AiBlogCover } from './ai-blog-cover'
import { ImageField } from './inspector'

export function BlogCoverPanel({ projectId, page, imageUrls, onChange }: {
  projectId: string; page: WebsitePage; imageUrls: Record<string, string>; onChange: (url: string, alt: string) => void
}) {
  const article = page.sections.find(section => section.componentId === 'BlogArticle')
  if (!article) return null
  const url = String(article.props.imageUrl ?? '')
  const alt = String(article.props.imageAlt ?? '')
  return <details className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-xs">
    <summary className="cursor-pointer text-sm font-semibold">{url ? 'Add or replace blog cover' : 'Add a blog cover'}</summary>
    <div className="mt-3 grid gap-3">
      <p>Generate a cover with AI, upload your own, or choose from the image library. Save to keep your change.</p>
      <AiBlogCover projectId={projectId} topic={page.title} keyword={page.contentBrief?.keyword ?? ''} details={page.contentBrief?.details ?? ''} requiredDirection initialDirection={[page.contentBrief?.imageSubject, page.contentBrief?.imageStyle].filter(Boolean).join('\n')} onUse={onChange} />
      <ImageField projectId={projectId} imageUrls={{ ...imageUrls, ...(url ? { [url]: `/api/projects/${projectId}/editor-image?thumbnail=1&url=${encodeURIComponent(url)}` } : {}) }} value={url} onChange={value => onChange(value, alt || page.title)} />
      <label className="grid gap-1">Cover image alt text<input className="rounded border p-2" maxLength={300} value={alt} onChange={event => onChange(url, event.target.value)} /></label>
    </div>
  </details>
}
