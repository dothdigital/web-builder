'use client'

import dynamic from 'next/dynamic'
import { loadEditableImage, saveEditedCanvas } from '@/lib/image-editor-assets'
import { Component, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { FilerobotImageEditorConfig } from 'react-filerobot-image-editor'

const Filerobot = dynamic(() => import('react-filerobot-image-editor'), {
  ssr: false,
  loading: () => <p role="status" className="p-6">Loading image tools…</p>,
})
const button = 'rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:opacity-50'

class ImageToolsBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    return this.state.failed ? <p role="alert" className="p-6 text-red-700">The image tools could not load. Close this popup and try again.</p> : this.props.children
  }
}

export default function ImageEditorDialog({ projectId, source, onClose, onSaved }: {
  projectId: string
  source: string
  onClose: () => void
  onSaved: (url: string) => void
}) {
  const root = useRef<HTMLDivElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const dirty = useRef(false)
  const saving = useRef(false)
  const [image, setImage] = useState<HTMLImageElement>()
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [busy, setBusy] = useState(false)
  const [discard, setDiscard] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const requestClose = () => {
    if (saving.current) return
    if (dirty.current) setDiscard(true)
    else onClose()
  }

  useEffect(() => {
    const focused = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    const background = Array.from(document.body.children).filter(element => element !== root.current) as HTMLElement[]
    const inert = background.map(element => element.inert)
    background.forEach(element => { element.inert = true })
    document.body.style.overflow = 'hidden'
    closeButton.current?.focus()
    // Filerobot menus are portaled to body; keep those interactive, too.
    const focus = (event: FocusEvent) => {
      if (background.some(element => element.contains(event.target as Node))) closeButton.current?.focus()
    }
    document.addEventListener('focusin', focus)
    return () => {
      background.forEach((element, index) => { element.inert = inert[index] })
      document.body.style.overflow = overflow
      document.removeEventListener('focusin', focus)
      if (focused?.isConnected) focused.focus()
    }
  }, [])

  useEffect(() => {
    let active = true
    let release: (() => void) | undefined
    const controller = new AbortController()
    void loadEditableImage(projectId, source, controller.signal).then(result => {
      release = result.release
      if (active) setImage(result.image)
      else release()
    }).catch(error => { if (active) setLoadError(error instanceof Error ? error.message : 'Could not load the image. Please try again.') })
    return () => { active = false; controller.abort(); release?.() }
  }, [projectId, source, attempt])

  const save: NonNullable<FilerobotImageEditorConfig['onSave']> = async data => {
    if (saving.current) return
    saving.current = true
    setBusy(true)
    setSaveError('')
    try {
      const canvas = data.imageCanvas
      if (!canvas) throw new Error('The edited image could not be exported. Please try again.')
      onSaved(await saveEditedCanvas(projectId, canvas))
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save this image. Your edits are still open; please try again.')
    } finally {
      saving.current = false
      setBusy(false)
    }
  }

  return createPortal(<div ref={root} data-awb-image-editor="true" className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/55 p-2 sm:p-5" onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') event.preventDefault(); if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); requestClose() } }} onClick={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()}>
    <section role="dialog" aria-modal="true" aria-labelledby="image-editor-title" aria-describedby="image-editor-description" className="relative flex h-[94dvh] w-full max-w-[1440px] flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white text-neutral-900 shadow-2xl">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
        <div><h2 id="image-editor-title" className="text-lg font-semibold">Edit image</h2><p id="image-editor-description" className="text-xs text-neutral-500">Save creates a new library image. Your original stays available.</p></div>
        <button ref={closeButton} type="button" className={button} disabled={busy} onClick={requestClose} aria-label="Close image editor">Cancel / close</button>
      </header>
      {loadError ? <div className="grid gap-3 p-6"><p role="alert" className="text-sm text-red-700">{loadError}</p><button type="button" className={`${button} justify-self-start`} onClick={() => { setLoadError(''); setImage(undefined); setAttempt(value => value + 1) }}>Retry loading image</button></div> : !image ? <p role="status" className="p-6 text-sm">Loading original image…</p> : <div className="min-h-0 flex-1" aria-busy={busy}>
        <ImageToolsBoundary><Filerobot source={image} tabsIds={['Adjust', 'Finetune', 'Filters', 'Resize', 'Annotate']} defaultTabId="Adjust" defaultToolId="Rotate" Rotate={{ angle: 90, componentType: 'buttons' }} savingPixelRatio={1} previewPixelRatio={Math.min(window.devicePixelRatio || 1, 2)} defaultSavedImageName="edited-image" defaultSavedImageType="png" onBeforeSave={() => false} closeAfterSave={false} showBackButton={false} onClose={requestClose} onSave={save} onModify={() => { dirty.current = true }} observePluginContainerSize useBackendTranslations={false} translations={{ save: 'Save image', flipX: 'Flip horizontal', flipY: 'Flip vertical' }} theme={{ typography: { fontFamily: 'Arial, sans-serif' } }} /></ImageToolsBoundary>
      </div>}
      {saveError && <p role="alert" className="shrink-0 border-t bg-red-50 px-4 py-3 text-sm text-red-700">{saveError}</p>}
      {busy && <div role="status" className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 text-sm font-medium">Saving image to your library…</div>}
      {discard && <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/90 p-6"><div className="grid max-w-sm gap-4 rounded-xl border bg-white p-6 shadow-lg"><p className="font-medium">Discard these image edits?</p><p className="text-sm text-neutral-600">Your selected image will stay unchanged.</p><div className="flex gap-2"><button type="button" className={button} onClick={() => setDiscard(false)}>Keep editing</button><button type="button" className={`${button} bg-red-700 text-white`} onClick={onClose}>Discard changes</button></div></div></div>}
    </section>
  </div>, document.body)
}
