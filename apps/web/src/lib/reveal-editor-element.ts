/** Called only by sidebar navigation, so canvas editing never jumps the viewport. */
export function revealEditorElement(path?: string) {
  requestAnimationFrame(() => {
    const frame = document.querySelector<HTMLElement>('[data-awb-selected-frame="true"]')
    if (!frame) return
    const elements = Array.from(frame.querySelectorAll<HTMLElement>('[data-awb-element]'))
    let pointer = path
    let target: HTMLElement | undefined
    while (pointer && !target) {
      target = elements.find((element) => element.dataset.awbElement === pointer)
      pointer = pointer.slice(0, pointer.lastIndexOf('/'))
    }
    // Reveal nested menu and FAQ content before measuring its position.
    let parent = target?.parentElement
    while (parent && frame.contains(parent)) {
      if (parent instanceof HTMLDetailsElement) parent.open = true
      parent = parent.parentElement
    }
    if (!target || !target.getClientRects().length) target = frame
    let scroller = frame.parentElement
    while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement
    if (!scroller) return
    const bounds = target.getBoundingClientRect()
    const viewport = scroller.getBoundingClientRect()
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    scroller.scrollTo({
      top: scroller.scrollTop + bounds.top - viewport.top - Math.max(24, (scroller.clientHeight - Math.min(bounds.height, scroller.clientHeight - 48)) / 2),
      behavior: reducedMotion ? 'instant' : 'smooth',
    })
    if (!reducedMotion) target.animate([{ outline: '3px solid #0284c7', outlineOffset: '4px' }, { outline: '3px solid transparent', outlineOffset: '4px' }], { duration: 1200 })
  })
}
