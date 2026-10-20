'use client'
import { useEffect, useRef, useState } from 'react'

export function HtmlCodeEditor({ value, onApply }: { value: Record<string, unknown>; onApply: (value: Record<string, unknown>) => void }) {
  const [open, setOpen] = useState(false)
  return <><button type="button" className="rounded border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-900" onClick={()=>setOpen(true)}>Edit HTML</button>{open && <HtmlCodeDialog value={value} onClose={()=>setOpen(false)} onApply={onApply} />}</>
}
function HtmlCodeDialog({ value, onApply, onClose }: { value: Record<string, unknown>; onApply: (value: Record<string, unknown>) => void; onClose: () => void }) {
  const dialog=useRef<HTMLDialogElement>(null)
  const [html,setHtml]=useState(String(value.html??''))
  const [css,setCss]=useState(String(value.css??''))
  const [javascript,setJavascript]=useState(String(value.javascript??''))
  const [height,setHeight]=useState(Number(value.height)||300)
  useEffect(()=>{const element=dialog.current!;element.showModal();return()=>element.close()},[])
  const codeClass='w-full resize-y rounded border border-neutral-300 bg-neutral-50 p-3 font-mono text-sm'
  return <dialog ref={dialog} aria-label="HTML / Embed editor" onCancel={onClose} className="m-auto w-[min(900px,94vw)] max-h-[90dvh] overflow-hidden rounded-xl border bg-white p-0 text-neutral-900 shadow-2xl backdrop:bg-black/40">
    <div className="flex max-h-[90dvh] flex-col">
      <div className="flex shrink-0 items-center justify-between border-b p-4"><h2 className="text-lg font-semibold">HTML / Embed editor</h2><button type="button" aria-label="Close HTML editor" className="rounded px-3 py-2" onClick={onClose}>×</button></div>
      <div className="grid min-h-0 gap-4 overflow-y-auto p-4">
        <p className="text-sm text-neutral-600">Paste your HTML below. Add CSS and JavaScript if needed. Open Preview to run your code.</p>
        <label className="grid gap-2 text-sm font-medium">HTML code<textarea autoFocus spellCheck={false} rows={12} maxLength={50000} value={html} onChange={event=>setHtml(event.target.value)} className={codeClass} placeholder="Paste HTML here…" /></label>
        <details><summary className="cursor-pointer text-sm font-medium">CSS (optional)</summary><label className="mt-2 grid gap-2 text-sm">CSS code<textarea spellCheck={false} rows={6} maxLength={20000} value={css} onChange={event=>setCss(event.target.value)} className={codeClass} placeholder="CSS without style tags" /></label></details>
        <details><summary className="cursor-pointer text-sm font-medium">JavaScript (optional)</summary><label className="mt-2 grid gap-2 text-sm">JavaScript code<textarea spellCheck={false} rows={6} maxLength={50000} value={javascript} onChange={event=>setJavascript(event.target.value)} className={codeClass} placeholder="JavaScript without script tags" /></label></details>
        <label className="grid max-w-48 gap-2 text-sm">Content height (px)<input type="number" min={40} max={2000} value={height} onChange={event=>setHeight(Number(event.target.value))} className="rounded border p-2" /></label>
      </div>
      <div className="flex shrink-0 justify-end gap-2 border-t p-4"><button type="button" className="rounded border px-4 py-2 text-sm" onClick={onClose}>Cancel</button><button type="button" className="rounded bg-sky-700 px-4 py-2 text-sm text-white" onClick={()=>{onApply({...value,html,css,javascript,height:Math.max(40,Math.min(2000,height||300))});onClose()}}>Apply HTML</button></div>
    </div>
  </dialog>
}
