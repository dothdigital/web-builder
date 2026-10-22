'use client'

import { useEffect, useRef, useState } from 'react'
import { selectableLayouts, type LayoutChoice } from '@awb/shared/layout-catalogue'
import styles from './layout-gallery.module.css'

export function LayoutGallery({ onSelect }: { onSelect: (id?: string) => void }) {
  const [preview, setPreview] = useState<LayoutChoice>()
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { if (preview) dialog.current?.showModal() }, [preview])
  const close = () => { dialog.current?.close(); setPreview(undefined) }
  return <div className={styles.gallery}>
    <p className="wt-eyebrow">CREATE YOUR WEBSITE · 1. CHOOSE A LAYOUT</p>
    <h1>Start with a layout you love.</h1>
    <p>Choose Business Classic or let AI create a layout from your business details.</p>
    <div className={styles.custom}><div><h2>Let AI choose the layout</h2><p>AI will choose the page structure and sections from your business details.</p></div><button type="button" className="wt-button" onClick={() => onSelect(undefined)}>Let AI choose the layout</button></div>
    <div className={styles.grid}>{selectableLayouts.map(layout => <article key={layout.id} className={styles.card}>
      <button type="button" className={styles.thumbnail} aria-label={`Preview ${layout.name}`} onClick={() => { setDevice('desktop'); setPreview(layout) }}>
        {/* Uploaded theme screenshots are served as static assets. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={layout.thumbnail} alt={`${layout.name} homepage layout`} loading="lazy" width={720} height={540} />
      </button>
      <div className={styles.details}><span>{layout.category}</span><h2>{layout.name}</h2><div className={styles.actions}>
        <button type="button" className="wt-button secondary" onClick={() => { setDevice('desktop'); setPreview(layout) }}>Preview</button>
        <button type="button" className="wt-button" onClick={() => onSelect(layout.id)}>Use this layout</button>
      </div></div>
    </article>)}</div>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="layout-preview-title" onCancel={() => setPreview(undefined)}>
      {preview && <><header><div><h2 id="layout-preview-title">{preview.name}</h2><p>Sample content and photography. Your website will use your business details.</p></div><div className={styles.actions}>
        <button type="button" aria-pressed={device === 'desktop'} className="wt-button secondary" onClick={() => setDevice('desktop')}>Desktop</button>
        <button type="button" aria-pressed={device === 'mobile'} className="wt-button secondary" onClick={() => setDevice('mobile')}>Mobile</button>
        <button type="button" className="wt-button" onClick={() => { const id = preview.id; close(); onSelect(id) }}>Use this layout</button>
        <button type="button" className="wt-button secondary" onClick={close}>Close</button>
      </div></header><div className={styles.previewSurface}><iframe key={preview.id} title={`${preview.name} full preview`} src={preview.preview} sandbox="allow-scripts" referrerPolicy="no-referrer" className={device === 'mobile' ? styles.mobile : styles.desktop} /></div></>}
    </dialog>
  </div>
}
