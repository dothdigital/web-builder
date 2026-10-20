'use client'
import { useEffect, useRef, useState } from 'react'
import type {WebsiteModel,WebsitePage} from '@awb/website-model'
import {pagePathFromName} from '@/lib/page-address'
import {copyPageRequestSchema,suggestPageCopy,type CopyPageRequest} from '@/lib/copy-page'
export function CopyPageDialog({model,page,onCopy,onClose}:{model:WebsiteModel;page:WebsitePage;onCopy:(request:CopyPageRequest)=>void;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null)
 const [request,setRequest]=useState(()=>suggestPageCopy(model,page))
 const [error,setError]=useState('')
 useEffect(()=>{const element=dialog.current!;element.showModal();return()=>element.close()},[])
 return <dialog ref={dialog} aria-label="Copy page" onCancel={onClose} className="m-auto w-[min(520px,94vw)] max-h-[90dvh] overflow-auto rounded-xl border bg-white p-5 text-neutral-900 shadow-xl backdrop:bg-black/40">
  <h2 className="text-lg font-semibold">Copy page</h2><p className="my-3 text-sm text-neutral-600">Copy “{page.title}” with its content and layout. Edit the copy independently. The shared header and footer stay shared.</p>
  <div className="grid gap-4"><label className="grid gap-1 text-sm">New page name<input autoFocus value={request.title} maxLength={200} onChange={event=>{const title=event.target.value;setRequest(value=>({...value,title,path:pagePathFromName(model,title)}))}} className="rounded border p-2" /></label>
  <label className="grid gap-1 text-sm">New page URL<input value={request.path} maxLength={200} onChange={event=>setRequest(value=>({...value,path:event.target.value}))} className="rounded border p-2" placeholder="/about-copy" /></label>
  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={request.addToNavigation} onChange={event=>setRequest(value=>({...value,addToNavigation:event.target.checked}))} />Add copy to navigation</label>
  {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
  <div className="flex justify-end gap-2"><button type="button" className="rounded border px-4 py-2 text-sm" onClick={onClose}>Cancel</button><button type="button" className="rounded bg-sky-700 px-4 py-2 text-sm text-white" onClick={()=>{const parsed=copyPageRequestSchema.safeParse(request);if(!parsed.success){setError(parsed.error.issues.map(issue=>issue.message).join(' '));return}try{onCopy(parsed.data);onClose()}catch(failure){setError(failure instanceof Error?failure.message:'Could not copy this page.')}}}>Create page copy</button></div></div>
 </dialog>
}
