'use client'
import { useEffect, useRef, useState } from 'react'
import { objectChoices, type ManualObjectKind } from '@/lib/add-manual-object'

function ObjectIcon({ kind }: { kind: ManualObjectKind }) {
  const paths: Record<string, string> = {
    form: 'M3 3h18v18H3z M6 7h12 M6 11h12 M6 15h6 M6 18h6',
    columns: 'M3 4h18v16H3z M12 4v16', button: 'M3 7h18v10H3z', divider: 'M3 12h18',
    image: 'M3 3h18v18H3z M3 17l6-6 4 4 3-3 5 5 M7 7h1', social: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M2 21v-3a7 7 0 0 1 14 0v3 M17 4a4 4 0 0 1 0 7 M19 14a6 6 0 0 1 3 5v2',
    menu: 'M4 6h16 M4 12h16 M4 18h16', embed: 'M8 5l-6 7 6 7 M16 5l6 7-6 7 M14 3l-4 18',
    bullets: 'M3 6h1 M3 12h1 M3 18h1 M8 6h13 M8 12h13 M8 18h13', spacer: 'M4 3h16 M4 21h16 M12 6v12 M9 9l3-3 3 3 M9 15l3 3 3-3',
  }
  return <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind] ? <path d={paths[kind]} /> : <text x="12" y="18" textAnchor="middle" fill="currentColor" stroke="none" fontSize={kind === 'numbered' ? '18' : '23'} fontFamily="Georgia,serif">{kind === 'heading' ? 'H' : kind === 'text' ? '¶' : kind === 'quote' ? '❞' : '1.'}</text>}</svg>
}
export function AddObjectDialog({ sections, initialSectionId, onAdd, onClose }: {
  sections: Array<{ id: string; label: string }>; initialSectionId?: string
  onAdd: (kind: ManualObjectKind, sectionId: string) => void; onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [target, setTarget] = useState(initialSectionId ?? sections[0]?.id ?? 'new')
  const [error, setError] = useState('')
  useEffect(() => { const node = dialog.current!; node.showModal(); return () => node.close() }, [])
  return <dialog ref={dialog} aria-labelledby="add-object-title" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose() }} className="fixed inset-0 m-auto max-h-[85vh] w-[min(600px,94vw)] overflow-y-auto rounded-xl border border-neutral-200 bg-white p-0 text-neutral-900 shadow-2xl backdrop:bg-black/40">
    <div className="sticky top-0 z-10 border-b bg-white p-4"><div className="flex items-center justify-between"><h2 id="add-object-title" className="text-lg font-semibold">Add object</h2><button type="button" aria-label="Close add object" className="rounded px-3 py-2 hover:bg-neutral-100" onClick={onClose}>✕</button></div>
      <label className="mt-2 grid gap-1 text-sm">Add to section<select className="w-full rounded border p-2" value={target} onChange={event => { setTarget(event.target.value); setError('') }}>{sections.map(section => <option key={section.id} value={section.id}>{section.label}</option>)}<option value="new">+ New blank section</option></select></label>
      <p className="mt-2 text-xs text-neutral-500">Choose an object, then edit it in Properties. No AI required.</p>
    </div>
    <div className="grid grid-cols-3 gap-3 p-4">{objectChoices.map(([kind, label]) => <button key={kind} type="button" className="flex min-h-28 flex-col items-center justify-center gap-3 rounded-lg border border-neutral-300 bg-white px-2 py-4 text-sm font-medium shadow-sm hover:border-sky-500 hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-sky-600" onClick={() => { try { onAdd(kind, target); onClose() } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not add object.') } }}><ObjectIcon kind={kind} />{label}</button>)}</div>
    {error && <p role="alert" className="px-4 pb-4 text-sm text-red-700">{error}</p>}
  </dialog>
}
