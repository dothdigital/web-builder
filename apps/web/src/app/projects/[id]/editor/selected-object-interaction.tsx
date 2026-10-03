'use client'

import { useLayoutEffect, useRef } from 'react'

export type MovePointer = {
  button: number; clientX: number; clientY: number; pointerId: number;
  currentTarget: HTMLElement; preventDefault: () => void; stopPropagation: () => void;
}

export function SelectedObjectInteraction({ element, onStart, onMove, onFinish, onCancel, onNudge }: {
  element: HTMLElement;
  onStart: (event: MovePointer) => void;
  onMove: (x: number, y: number) => void;
  onFinish: () => void;
  onCancel: () => void;
  onNudge: (x: number, y: number) => void;
}) {
  const handlers = useRef({ onStart, onMove, onFinish, onCancel, onNudge })
  useLayoutEffect(() => { handlers.current = { onStart, onMove, onFinish, onCancel, onNudge } }, [onStart, onMove, onFinish, onCancel, onNudge])
  useLayoutEffect(() => bindSelectedObjectInteraction(element, () => handlers.current), [element])
  return null
}

export function bindSelectedObjectInteraction(element: HTMLElement, getHandlers: () => { onStart: (event: MovePointer) => void; onMove: (x: number, y: number) => void; onFinish: () => void; onCancel: () => void; onNudge: (x: number, y: number) => void }) {
    const oldCursor = element.style.cursor, oldTouch = element.style.touchAction
    const oldTabIndex = element.getAttribute('tabindex'), oldDraggable = element.getAttribute('draggable')
    element.style.setProperty('cursor', 'move'); element.style.setProperty('touch-action', 'none')
    element.setAttribute('tabindex', '0'); element.setAttribute('draggable', 'false')
    let pointer: number | undefined
    const down = (event: PointerEvent) => {
      const target = event.target as HTMLElement
      if (event.button !== 0 || event.shiftKey || target.isContentEditable || target.closest('input,textarea,select,[contenteditable="plaintext-only"],[contenteditable="true"]')) return
      if (target.closest('[data-awb-element]') !== element && !element.contains(target)) return
      pointer = event.pointerId
      getHandlers().onStart({ button: event.button, clientX: event.clientX, clientY: event.clientY, pointerId: event.pointerId, currentTarget: element, preventDefault: () => event.preventDefault(), stopPropagation: () => event.stopPropagation() })
    }
    const move = (event: PointerEvent) => { if (event.pointerId === pointer) getHandlers().onMove(event.clientX, event.clientY) }
    const up = (event: PointerEvent) => {
      if (event.pointerId !== pointer) return
      pointer = undefined
      getHandlers().onMove(event.clientX, event.clientY)
      getHandlers().onFinish()
    }
    const cancel = () => { pointer = undefined; getHandlers().onCancel() }
    const key = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || target?.isContentEditable || target?.closest('input,textarea,select,[contenteditable="plaintext-only"],[contenteditable="true"]')) return
      if (event.key === 'Escape') { cancel(); return }
      if (event.key === 'Enter' && target === element && element.dataset.awbPointer) {
        event.preventDefault()
        element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }))
        return
      }
      const direction: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
      const delta = direction[event.key]
      if (!delta) return
      event.preventDefault(); event.stopPropagation()
      const step = event.shiftKey ? 10 : 1
      getHandlers().onNudge(delta[0] * step, delta[1] * step)
    }
    element.addEventListener('pointerdown', down)
    element.addEventListener('pointermove', move)
    element.addEventListener('pointerup', up)
    element.addEventListener('pointercancel', cancel)
    element.addEventListener('lostpointercapture', cancel)
    window.addEventListener('keydown', key)
    return () => {
      getHandlers().onCancel()
      element.style.setProperty('cursor', oldCursor); element.style.setProperty('touch-action', oldTouch)
      if (oldTabIndex === null) element.removeAttribute('tabindex'); else element.setAttribute('tabindex', oldTabIndex)
      if (oldDraggable === null) element.removeAttribute('draggable'); else element.setAttribute('draggable', oldDraggable)
      element.removeEventListener('pointerdown', down); element.removeEventListener('pointermove', move)
      element.removeEventListener('pointerup', up); element.removeEventListener('pointercancel', cancel)
      element.removeEventListener('lostpointercapture', cancel); window.removeEventListener('keydown', key)
    }

}
