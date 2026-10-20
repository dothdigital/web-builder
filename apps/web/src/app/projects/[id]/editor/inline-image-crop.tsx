'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import ReactCrop, { type PercentCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { imageVisibleBounds } from '@/lib/image-visible-bounds'
import { imageCropSource, type SourceRect } from '@/lib/image-crop-source'
import { loadEditableImage, saveEditedCanvas } from '@/lib/image-editor-assets'

type Frame = { left: number; top: number; width: number; height: number }
const initialCrop: PercentCrop = { unit: '%', x: 0, y: 0, width: 100, height: 100 }
const button = 'rounded border border-neutral-300 px-3 py-2 text-xs font-medium disabled:opacity-50'

export default function InlineImageCrop({ projectId, source, element, onClose, onSaved }: {
  projectId: string; source: string; element: HTMLElement; onClose: () => void; onSaved: (url: string) => void
}) {
  const root = useRef<HTMLDivElement>(null)
  const preview = useRef<HTMLCanvasElement>(null)
  const loaded = useRef<HTMLImageElement>(null)
  const sourceRect = useRef<SourceRect>(null)
  const [frame, setFrame] = useState<Frame>()
  const [crop, setCrop] = useState<PercentCrop>(initialCrop)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const saving = useRef(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const cancel = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const focused = document.activeElement as HTMLElement | null
    const background = Array.from(document.body.children).filter(node => node !== root.current) as HTMLElement[]
    const inert = background.map(node => node.inert)
    background.forEach(node => { node.inert = true })
    element.scrollIntoView({ block: 'center', inline: 'nearest' })
    const measure = () => {
      const rect = imageVisibleBounds(element)
      if (!element.isConnected || !rect.width || !rect.height) return
      setFrame({ left: rect.left, top: rect.top, width: rect.width, height: rect.height })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    cancel.current?.focus({ preventScroll: true })
    return () => { background.forEach((node, index) => { node.inert = inert[index] }); observer.disconnect(); window.removeEventListener('scroll', measure, true); window.removeEventListener('resize', measure); if (focused?.isConnected) focused.focus({ preventScroll: true }) }
  }, [element])

  useEffect(() => {
    let active = true
    let release: (() => void) | undefined
    const controller = new AbortController()
    void loadEditableImage(projectId, source, controller.signal).then(result => {
      release = result.release
      if (!active) { release(); return }
      const image = result.image
      const style = getComputedStyle(element)
      const frame = imageVisibleBounds(element)
      const rect = imageCropSource(image.naturalWidth, image.naturalHeight, frame.width, frame.height, element instanceof HTMLImageElement ? style.objectFit : style.backgroundSize, element instanceof HTMLImageElement ? style.objectPosition : style.backgroundPosition)
      loaded.current = image
      sourceRect.current = rect
      const canvas = preview.current!
      canvas.width = Math.max(1, Math.round(rect.width))
      canvas.height = Math.max(1, Math.round(rect.height))
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Your browser could not open the crop tools.')
      context.drawImage(image, rect.x, rect.y, rect.width, rect.height, 0, 0, canvas.width, canvas.height)
      setReady(true)
    }).catch(failure => { if (active) setError(failure instanceof Error ? failure.message : 'Could not load this image.') })
    return () => { active = false; controller.abort(); release?.() }
  }, [projectId, source, element, attempt])

  const apply = async () => {
    if (saving.current || !loaded.current || !sourceRect.current || crop.width <= 0 || crop.height <= 0) return
    saving.current = true
    setBusy(true)
    setError('')
    try {
      const source = sourceRect.current
      const x = source.x + source.width * crop.x / 100, y = source.y + source.height * crop.y / 100
      const width = source.width * crop.width / 100, height = source.height * crop.height / 100
      const output = document.createElement('canvas')
      output.width = Math.max(1, Math.round(width)); output.height = Math.max(1, Math.round(height))
      const context = output.getContext('2d')
      if (!context) throw new Error('Could not export the crop. Please try again.')
      context.drawImage(loaded.current, x, y, width, height, 0, 0, output.width, output.height)
      const url = await saveEditedCanvas(projectId, output, 'cropped-image.png')
      onSaved(url)
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not save the crop. Your original is unchanged.') }
    finally { saving.current = false; setBusy(false) }
  }

  return createPortal(<div ref={root} data-awb-image-editor="crop" className="fixed inset-0 z-[1200]" onClick={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()} onKeyDown={event => { if (event.key === 'Escape' && !saving.current) { event.preventDefault(); onClose() } if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void apply() } }}>
    <style>{'body:has([data-awb-image-editor="crop"]) [aria-label^="Resize image"] { visibility: hidden !important; }'}</style>
    <div className="absolute inset-0 bg-black/10" aria-hidden="true" />
    <div role="region" aria-label="Crop image on canvas" className="fixed" style={frame ? { left: frame.left, top: frame.top, width: frame.width, height: frame.height } : { visibility: 'hidden' }}>
      <ReactCrop crop={crop} onChange={(_, percent) => setCrop(percent)} disabled={!ready || busy} keepSelection minWidth={8} minHeight={8} ruleOfThirds style={{ display: 'block', width: '100%', height: '100%' }}>
        <canvas ref={preview} aria-label="Image crop preview" style={{ display: 'block', width: frame?.width, height: frame?.height }} />
      </ReactCrop>
    </div>
    <div role="toolbar" aria-label="Crop controls" className="fixed flex max-w-[calc(100vw-16px)] flex-wrap items-center gap-2 rounded-lg border bg-white p-3 text-neutral-900 shadow-xl" style={{ left: Math.max(8, Math.min(frame?.left ?? 8, window.innerWidth - Math.min(520, window.innerWidth - 16) - 8)), top: Math.max(8, Math.min((frame?.top ?? 60) - 86, window.innerHeight - 160)), width: Math.min(520, window.innerWidth - 16) }}>
      <p className="basis-full text-xs">Drag the edges to crop. Saves a separate copy; your original stays in the library.</p>
      <button ref={cancel} type="button" className={button} disabled={busy} onClick={onClose}>Cancel crop</button>
      <button type="button" className={button} disabled={!ready || busy} onClick={() => setCrop(initialCrop)}>Reset crop</button>
      <button type="button" className={`${button} border-sky-700 bg-sky-700 text-white`} disabled={!ready || busy || crop.width <= 0 || crop.height <= 0} onClick={() => void apply()}>{busy ? 'Saving crop…' : 'Apply crop'}</button>
      {!ready && !error && <p role="status" className="text-xs">Loading original image…</p>}
      {error && <div className="basis-full text-xs"><p role="alert" className="text-red-700">{error}</p>{!ready && <button type="button" className="mt-2 underline" onClick={() => { setReady(false); setError(''); setAttempt(value => value + 1) }}>Retry loading image</button>}</div>}
    </div>
  </div>, document.body)
}
