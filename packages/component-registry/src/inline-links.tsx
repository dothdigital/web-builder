import React, { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { z } from 'zod'
import { ArticleBody } from './components/article-body'

export const safeTextLink = (url: string) => /^(https?:\/\/[^/\s]+|\/(?!\/)|#[^\s]+|mailto:[^\s]+|tel:[^\s]+)/i.test(url) && !/[\s\\\u0000-\u001f\u007f]/.test(url)
export const inlineLinkSchema = z.object({ text: z.string().min(1).max(10000), occurrence: z.number().int().min(0).max(10000).default(0), href: z.string().max(4000).refine(safeTextLink), newTab: z.boolean().default(false) })
export const inlineLinksSchema = z.record(z.string().regex(/^\/[a-zA-Z0-9_/-]+$/), z.array(inlineLinkSchema).max(100)).default({})
export type InlineLink = z.infer<typeof inlineLinkSchema>
export function textOccurrence(text: string, selected: string, before: number) {
  let count = 0, at = text.indexOf(selected)
  while (at >= 0 && at < before) { count++; at = text.indexOf(selected, at + selected.length) }
  return count
}
const textOf = (tree: ReactNode): string => Children.toArray(tree).map(child => typeof child === 'string' || typeof child === 'number' ? String(child) : isValidElement(child) ? textOf((child.props as { children?: ReactNode }).children) : '').join('')
function linkedChildren(tree: ReactNode, links: InlineLink[]): ReactNode {
  const text = textOf(tree)
  const ranges = links.flatMap(link => {
    let at = text.indexOf(link.text)
    for (let i = 0; i < link.occurrence && at >= 0; i++) at = text.indexOf(link.text, at + link.text.length)
    return at < 0 ? [] : [{ ...link, start: at, end: at + link.text.length }]
  }).sort((a, b) => a.start - b.start)
  let cursor = 0
  const walk = (nodes: ReactNode): ReactNode => Children.map(nodes, child => {
    if (typeof child === 'string' || typeof child === 'number') {
      const value = String(child), start = cursor; cursor += value.length
      const result: ReactNode[] = []; let offset = 0
      for (const link of ranges) {
        const from = Math.max(0, link.start - start), to = Math.min(value.length, link.end - start)
        if (from < offset || to <= from) continue
        result.push(value.slice(offset, from), <a key={`${start}-${from}`} href={link.href} target={link.newTab ? '_blank' : undefined} rel={link.newTab ? 'noopener noreferrer' : undefined} data-awb-text-link="true" style={{ color: 'inherit', textDecoration: 'underline' }}>{value.slice(from, to)}</a>); offset = to
      }
      result.push(value.slice(offset)); return result
    }
    if (!isValidElement(child)) return child
    const element = child as ReactElement<Record<string, unknown>>
    if (element.type === 'a' || element.type === 'button') { cursor += textOf(element.props.children as ReactNode).length; return element }
    return cloneElement(element, {}, walk(element.props.children as ReactNode))
  })
  return walk(tree)
}
export function applyInlineLinks(tree: ReactNode, props: Record<string, unknown>): ReactNode {
  const parsed = inlineLinksSchema.safeParse(props.inlineLinks)
  if (!parsed.success || !Object.keys(parsed.data).length) return tree
  const walk = (nodes: ReactNode): ReactNode => Children.map(nodes, child => {
    if (!isValidElement(child)) return child
    let element = child as ReactElement<Record<string, unknown>>
    const path = element.props['data-awb-element'] as string | undefined
    const links = path ? parsed.data[path] : undefined
    if (links?.length && element.type !== 'a' && element.type !== 'button') {
      if (element.type === ArticleBody) element = ArticleBody(element.props as Parameters<typeof ArticleBody>[0]) as ReactElement<Record<string, unknown>>
      if (element.props.children !== undefined) return cloneElement(element, { 'data-awb-rich-text': 'true' }, linkedChildren(element.props.children as ReactNode, links))
    }
    return element.props.children !== undefined ? cloneElement(element, {}, walk(element.props.children as ReactNode)) : element
  })
  return walk(tree)
}
