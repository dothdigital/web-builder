'use client'

import { useEffect, useLayoutEffect, useRef } from 'react'

const inlineSessions = new Set<{ finish: () => void; active: () => boolean }>()
export function flushInlineTextEdits() { for (const session of [...inlineSessions]) session.finish() }
export function hasActiveInlineEdit() { return [...inlineSessions].some(session => session.active()) }

const skippedKeys = new Set([
  'html', 'css', 'javascript', 'kind', 'headingLevel',
  'href',
  'src',
  'url',
  'image',
  'imageUrl',
  'icon',
  'id',
  'variant',
  'align',
  'alt',
  'color',
  'background',
  'target',
  'anchor',
  'value',
])

const editableSelector = '[data-awb-inline-text],h1,h2,h3,h4,h5,h6,p,li,span,a,strong,em,blockquote,figcaption,dt,dd,button'

/// Flattens section props into JSON-pointer → string pairs for the strings that
/// are plausible on-canvas copy (skipping URLs, colours and enum-ish values).
export function textPointers(props: unknown, base = ''): Array<{ pointer: string; value: string }> {
  const out: Array<{ pointer: string; value: string }> = []

  const walk = (node: unknown, pointer: string, key: string) => {
    if (key === 'inlineLinks') return
    if (typeof node === 'string') {
      const value = node.trim()

      if (
        value.length > 0 &&
        !skippedKeys.has(key) &&
        !value.startsWith('http') &&
        !value.startsWith('/') &&
        !value.startsWith('#')
      ) {
        out.push({ pointer, value })
      }

      return
    }

    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, `${pointer}/${index}`, key))
      return
    }

    if (node && typeof node === 'object') {
      for (const [childKey, child] of Object.entries(node as Record<string, unknown>)) {
        walk(child, `${pointer}/${childKey}`, childKey)
      }
    }
  }

  walk(props, base, '')

  return out
}

/// Selection defaults to moving objects. Double-click enters text editing;
/// Enter/Escape or blur exits it and commits to the exact content pointer.
export function useInlineTextEditing(
  container: HTMLElement | null,
  active: boolean,
  props: unknown,
  onCommit: (pointer: string, value: string) => void,
) {
  const commitRef = useRef(onCommit)
  useLayoutEffect(() => { commitRef.current = onCommit }, [onCommit])
  useEffect(() => {
    if (!container || !active) return
    return bindInlineTextEditing(container, props, (pointer, value) => commitRef.current(pointer, value))
  }, [container, active, props])
}

export function bindInlineTextEditing(container: HTMLElement, props: unknown, onCommit: (pointer: string, value: string) => void) {
    const pairs = textPointers(props)
    const byPointer = new Map(pairs.map(({ pointer, value }) => [pointer, value]))
    const pending = new Map<string, string>()
    for (const { pointer, value } of pairs) {
      if (!pending.has(value)) {
        pending.set(value, pointer)
      }
    }

    const cleanups: Array<() => void> = []

    for (const element of Array.from(container.querySelectorAll<HTMLElement>(editableSelector))) {
      const multiline = element.hasAttribute('data-awb-inline-text')
      const rich = element.hasAttribute('data-awb-rich-text')
      if (element.parentElement?.closest('[data-awb-inline-text],[data-awb-rich-text]') || (!multiline && !rich && element.childElementCount > 0)) {
        continue
      }

      const text = element.textContent?.trim() ?? ''
      const path = element.dataset.awbElement
      const exact = path ? [path, `${path}/label`, `${path}/text`].find((candidate) => byPointer.get(candidate) === text) : undefined
      const pointer = multiline && path && byPointer.has(path) ? path : exact ?? pending.get(text)

      if (!pointer) {
        continue
      }

      pending.delete(text)

      const originalText = byPointer.get(pointer) ?? text
      let originalNodes: ChildNode[] = []
      let editing = false
      const previousCursor = element.style.cursor
      const previousOutline = element.style.outline
      const previousWhiteSpace = element.style.whiteSpace
      const previousTitle = element.getAttribute('title')
      element.dataset.awbPointer = pointer
      element.title = 'Double-click to edit text'
      element.style.cursor = 'move'

      const onBlur = () => {
        if (!editing) return
        editing = false
        element.removeAttribute('contenteditable')
        element.style.cursor = 'move'
        const next = (multiline ? element.innerText : element.textContent)?.replace(/\r\n?/g, '\n').trim() ?? ''
        if (multiline || rich) { element.replaceChildren(...originalNodes); element.style.whiteSpace = previousWhiteSpace }

        if (next !== originalText) {
          onCommit(pointer, next)
        }
      }

      const onKeyDown = (event: KeyboardEvent) => {
        if (!editing) return
        event.stopPropagation()

        if (event.key === 'Enter' && (multiline ? event.ctrlKey || event.metaKey : !event.shiftKey)) {
          event.preventDefault()
          element.blur()
        }

        if (event.key === 'Escape') {
          element.textContent = originalText
          element.blur()
        }
      }

      const onClick = (event: MouseEvent) => event.stopPropagation()
      const onDoubleClick = (event: MouseEvent) => {
        event.preventDefault(); event.stopPropagation()
        if (editing) return
        editing = true
        if (multiline || rich) { originalNodes = Array.from(element.childNodes); element.textContent = originalText; element.style.whiteSpace = 'pre-wrap' }
        element.setAttribute('contenteditable', 'plaintext-only')
        element.style.cursor = 'text'
        element.focus({ preventScroll: true })
      }

      const session = { finish: onBlur, active: () => editing }
      inlineSessions.add(session)
      const onInput = () => { if (editing) window.dispatchEvent(new Event('awb-inline-input')) }
      element.addEventListener('input', onInput)
      element.addEventListener('dblclick', onDoubleClick)
      element.addEventListener('blur', onBlur)
      element.addEventListener('keydown', onKeyDown)
      element.addEventListener('click', onClick)

      cleanups.push(() => {
        // Commit before selection or rerender removes the editable DOM.
        onBlur()
        inlineSessions.delete(session)
        element.removeEventListener('input', onInput)
        element.removeEventListener('dblclick', onDoubleClick)
        element.removeEventListener('blur', onBlur)
        element.style.cursor = previousCursor
        element.style.outline = previousOutline
        element.style.whiteSpace = previousWhiteSpace
        if (previousTitle === null) element.removeAttribute('title'); else element.setAttribute('title', previousTitle)
        if (editing && (multiline || rich)) element.replaceChildren(...originalNodes)
        element.removeEventListener('keydown', onKeyDown)
        element.removeEventListener('click', onClick)
        element.removeAttribute('contenteditable')
        delete element.dataset.awbPointer
      })
    }

    return () => {
      for (const cleanup of cleanups) {
        cleanup()
      }
    }
}
