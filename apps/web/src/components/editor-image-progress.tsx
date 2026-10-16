'use client'
import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
let blockers = 0
let originalInert = false
let originalOverflow = ''
let originalFocus: HTMLElement | null = null

export function EditorImageProgress({ visible }: { visible: boolean }) {
 const ref = useRef<HTMLDivElement>(null)
 const titleId = useId()
 useEffect(() => {
  if (!visible) return
  const root = document.querySelector<HTMLElement>('[data-awb-editor-root]')
  if (blockers++ === 0) { originalInert = root?.inert ?? false; originalOverflow = document.body.style.overflow; originalFocus = document.activeElement as HTMLElement | null }
  if (root) root.inert = true
  document.body.style.overflow = 'hidden'
  ref.current?.focus()
  const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
  const blockKeys = (event: KeyboardEvent) => { event.preventDefault(); event.stopImmediatePropagation() }
  window.addEventListener('keydown', blockKeys, true)
  window.addEventListener('beforeunload', beforeUnload)
  return () => {
   window.removeEventListener('beforeunload', beforeUnload)
   window.removeEventListener('keydown', blockKeys, true)
   if (--blockers === 0) { if (root) root.inert = originalInert; document.body.style.overflow = originalOverflow; if (originalFocus?.isConnected) originalFocus.focus() }
  }
 }, [visible])
 if (!visible || typeof document === 'undefined') return null
 return createPortal(<div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-busy="true" tabIndex={-1} className="fixed inset-0 flex items-center justify-center bg-neutral-950/40 p-5 backdrop-blur-sm" style={{ zIndex: 2147483640 }} onKeyDown={event => { event.preventDefault(); event.stopPropagation() }}>
  <div className="grid max-w-sm justify-items-center gap-4 rounded-2xl bg-white p-8 text-center text-neutral-900 shadow-xl" role="status" aria-live="polite">
   <span aria-hidden="true" className="h-10 w-10 animate-spin rounded-full border-4 border-violet-200 border-t-violet-700" />
   <h2 id={titleId} className="text-xl font-semibold">Generating your image…</h2>
   <p className="text-sm text-neutral-600">Your new image will replace the selected image when ready. Please keep this page open.</p>
  </div>
 </div>, document.body)
}
