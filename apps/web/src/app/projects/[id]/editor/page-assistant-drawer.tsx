'use client'
import { ErrorNotice } from '@/components/error-notice'

import { useEffect, useRef, useState } from 'react'
import type { WebsiteModel } from '@awb/website-model'
import { assistantPlanSchema, type AssistantPlan } from '@awb/ai/editor-command'
import { queuePageAssistant, readPageAssistantJobs, finishPageAssistantJob } from '@/app/actions/page-assistant'
import { dismissContentJob } from '@/app/actions/content-jobs'
import { createContentWithAi, generateAiSection, rewritePageWithAi } from '@/app/actions/editor'
import { applyAssistantPlan, assistantTargets, resolveAssistantPlan, type AssistantSelection, type AssistantTarget } from '@/lib/page-assistant'
import { mergeAssistantChanges } from '@/lib/assistant-merge'
import { contentRequestSchema } from '@/lib/content-creation'
import { ImageField } from './inspector'
import { ContentCreatePanel } from './content-create-panel'

type Job = Awaited<ReturnType<typeof readPageAssistantJobs>>[number]
type Message = { role: 'user' | 'assistant'; text: string }
const editError = (failure: unknown) => failure instanceof Error && failure.name !== 'ZodError' && failure.name !== 'SyntaxError'
  ? failure.message : 'The AI returned an edit in an unsupported format. Your draft is unchanged. Please send the request again.'
type Proposal = { job: Job; plan: AssistantPlan; choices: Record<number, string[]>; question?: { index: number; text: string; choices: AssistantTarget[] }; confirmation?: string }
export function PageAssistantDrawer({ projectId, pageId, model, selection, imageUrls, open, onClose, onApply, onSelect, onUndo, canUndo, onPageSelect }: {
  projectId: string; pageId: string; model: WebsiteModel; selection?: AssistantSelection; imageUrls: Record<string, string>; open: boolean; onClose: () => void
  onApply: (next: WebsiteModel, baseline: WebsiteModel) => void; onSelect: (target: AssistantTarget) => void; onUndo: () => void; canUndo: boolean; onPageSelect: (id: string) => void
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [instruction, setInstruction] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [proposal, setProposal] = useState<Proposal>()
  const [menu, setMenu] = useState(false)
  const [tool, setTool] = useState<'page' | 'blog' | 'image'>()
  const [imageUrl, setImageUrl] = useState('')
  const [error, setError] = useState('')
  const log = useRef<HTMLDivElement>(null)
  const seen = useRef(new Set<string>())
  const pending = useRef(false)
  const current = useRef({ model, selection, onApply, onSelect, messages, imageUrl })
  useEffect(() => { current.current = { model, selection, onApply, onSelect, messages, imageUrl } }, [model, selection, onApply, onSelect, messages, imageUrl])
  useEffect(() => { if (open) log.current?.scrollTo({ top: log.current.scrollHeight, behavior: 'smooth' }) }, [messages, status, open])
  const say = (text: string) => setMessages(previous => [...previous, { role: 'assistant', text }])
  const finish = async (job: Job) => { await finishPageAssistantJob(projectId, job.id); window.dispatchEvent(new Event('awb-content-queued')) }
  const execute = async (job: Job, plan: AssistantPlan, choices: Record<number, string[]> = {}, confirmed = false) => {
    const latest = current.current.model
    const page = latest.pages.find(page => page.id === pageId)
    if (!page) throw new Error('This page no longer exists.')
    if (plan.kind === 'ask' || plan.kind === 'explain') { say(plan.message); await finish(job); return }
    if (!job.originalPage) throw new Error('The original page snapshot is missing. Please send your request again.')
    const baseline = { ...latest, pages: latest.pages.map(entry => entry.id === pageId ? job.originalPage! : entry), globalComponents: job.originalGlobals }
    if (plan.kind === 'edit') {
      const resolution = resolveAssistantPlan(baseline, pageId, plan, job.selection, choices)
      if (resolution.question) { setProposal({ job, plan, choices, question: resolution.question }); say(resolution.question.text); return }
      if ((resolution.shared || resolution.destructive) && !confirmed) {
        setProposal({ job, plan, choices, confirmation: resolution.shared ? 'This changes the shared header or footer on every page. Apply to the website draft?' : 'This removes a section or several objects. Apply this deletion to the draft?' }); return
      }
      const widths = Object.fromEntries(Array.from(document.querySelectorAll<HTMLElement>('[data-awb-section-id]')).map(frame => [frame.dataset.awbSectionId!, frame.getBoundingClientRect().width]))
      const proposed = applyAssistantPlan(baseline, pageId, plan, job.selection, choices, confirmed, widths)
      const next = mergeAssistantChanges(baseline, proposed, latest)
      current.current.onApply(next, latest)
      const first = resolution.operations[0]?.targets[0]
      if (first && plan.operations[0]?.action !== 'delete') current.current.onSelect(first)
      say(`${plan.message}\nApplied to your draft. Use Undo to revert; Save to update Preview.`)
    } else if (plan.kind === 'create') {
      const request = contentRequestSchema.parse({ ...JSON.parse(plan.requestJson), ...(current.current.imageUrl ? { coverImageUrl: current.current.imageUrl } : {}) })
      if (request.kind === 'blog' && !request.coverImageUrl) { say('Choose a cover image using + → Upload / choose image, then ask me to create the blog again.'); await finish(job); return }
      await createContentWithAi(projectId, { model: latest, request })
      say(`${plan.message}\nQueued in the background. Review the generated draft in the notification bar when it is ready.`)
    } else if (plan.kind === 'section') {
      await generateAiSection(projectId, { model: latest, pageId, componentId: 'auto', instruction: plan.instruction, insertIndex: page.sections.length })
      say('Your new section is queued in the background. Review and add it from the notification bar when ready.')
    } else {
      await rewritePageWithAi(projectId, { model: latest, pageId, instruction: plan.instruction })
      say('The page rewrite is queued in the background. Your current draft stays intact until you review the result.')
    }
    setProposal(undefined)
    await finish(job)
    window.dispatchEvent(new Event('awb-content-queued'))
  }
  const executeRef = useRef(execute)
  useEffect(() => { executeRef.current = execute })
  useEffect(() => {
    if (!open) return
    let active = true, polling = false
    const poll = async () => {
      if (polling || document.hidden) return
      polling = true
      try {
        const jobs = await readPageAssistantJobs(projectId, pageId)
        if (!active) return
        const working = jobs.some(job => ['QUEUED', 'RUNNING'].includes(job.status))
        setBusy(working || pending.current)
        setStatus(working ? jobs.some(job => job.status === 'RUNNING') ? 'Understanding your request… You can keep editing.' : 'Queued for the background worker…' : '')
        for (const job of jobs) {
          if (!active || seen.current.has(job.id) || !['READY', 'FAILED'].includes(job.status)) continue
          seen.current.add(job.id)
          if (job.status === 'FAILED') { say(job.error || 'The request failed. Please send it again.'); await dismissContentJob(job.id); continue }
          try {
            const output = job.result as { plan?: unknown } | null
            const parsed = assistantPlanSchema.safeParse(output?.plan)
            if (!parsed.success) throw new Error('This editor could not read the assistant’s reply. Save your draft, refresh the editor, then try the request again.')
            await executeRef.current(job, parsed.data)
          } catch (failure) {
            say(editError(failure))
            await finishPageAssistantJob(projectId, job.id)
          }
        }
      } catch { if (active) setStatus('Reconnecting to background requests…') }
      finally { polling = false }
    }
    void poll()
    const timer = setInterval(() => void poll(), 8000 + Math.random() * 2000)
    window.addEventListener('awb-content-queued', poll)
    return () => { active = false; clearInterval(timer); window.removeEventListener('awb-content-queued', poll) }
  }, [projectId, pageId, open])
  const runProposal = async (nextChoices: Record<number, string[]>, confirmed = false) => {
    if (!proposal || busy) return
    setBusy(true); setError('')
    try { await execute(proposal.job, proposal.plan, nextChoices, confirmed) }
    catch (failure) { setError(editError(failure)) }
    finally { setBusy(false) }
  }
  const send = async () => {
    if (!instruction.trim() || busy || pending.current) return
    setError(''); pending.current = true; setBusy(true)
    const text = instruction.trim()
    try {
      if (proposal) { await finish(proposal.job); setProposal(undefined) }
      await queuePageAssistant(projectId, { model: current.current.model, pageId, instruction: text, selection: current.current.selection, history: current.current.messages.slice(-12), imageUrl })
      setMessages(previous => [...previous, { role: 'user', text }]); setInstruction(''); setStatus('Queued for the background worker…')
      window.dispatchEvent(new Event('awb-content-queued'))
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not queue the request.'); setBusy(false) }
    finally { pending.current = false }
  }
  const page = model.pages.find(page => page.id === pageId)!
  const selectedNames = selection ? assistantTargets(model, pageId).filter(target => target.sectionId === selection.sectionId && target.scope === selection.scope && (selection.paths.length ? selection.paths.includes(target.path) : !target.path)).map(target => target.label) : []
  return <aside role="complementary" aria-label="AI page assistant" style={{ display: open ? undefined : 'none' }} className="fixed bottom-3 right-3 top-16 z-[900] flex w-[min(420px,calc(100vw-24px))] flex-col overflow-hidden rounded-xl border border-violet-200 bg-white text-neutral-900 shadow-2xl">
    <div className="border-b bg-violet-50 p-4"><div className="flex items-center justify-between"><h2 className="font-semibold">AI Assistant</h2><button type="button" aria-label="Close AI assistant" onClick={onClose} className="rounded px-2 py-1 hover:bg-violet-100">✕</button></div><p className="mt-1 text-sm">This page: <strong>{page.title}</strong> <span className="text-neutral-500">{page.path}</span></p><p className="mt-1 truncate text-xs text-neutral-600" title={selectedNames.join(', ')}>{selectedNames.length ? `Selected: ${selectedNames.join(', ')}` : 'Select an object, name a section, or describe what to change.'}</p></div>
    <div ref={log} role="log" aria-label="Assistant conversation" aria-live="polite" className="min-h-0 flex-1 overflow-y-auto p-4">
      {!messages.length && <div className="text-sm text-neutral-600"><p>I can edit text, colours, fonts, spacing, images and objects on this page. If several items match, I’ll ask which one.</p><p className="mt-3">Try “Make the hero heading blue” or “Add a contact form to the last section”. Use + for a new page, blog, or image.</p></div>}
      {messages.map((message, index) => <div key={index} className={`mb-3 whitespace-pre-wrap rounded-lg p-3 text-sm ${message.role === 'user' ? 'ml-6 bg-violet-100' : 'mr-3 bg-neutral-100'}`}><span className="mb-1 block text-xs font-semibold">{message.role === 'user' ? 'You' : 'Webtummy'}</span>{message.text}</div>)}
      {status && <p role="status" className="my-3 text-sm text-violet-700">{status}</p>}
      {proposal?.question && <div className="my-3 grid gap-2 rounded-lg border p-3 text-sm"><p className="font-medium">{proposal.question.text}</p>{proposal.question.choices.map(target => <div key={target.id} className="flex gap-1"><button type="button" className="min-w-0 flex-1 rounded border p-2 text-left hover:bg-violet-50" disabled={busy} onClick={() => { onSelect(target); void runProposal({ ...proposal.choices, [proposal.question!.index]: [target.id] }) }}>{target.section} · {target.label}</button><button type="button" className="rounded border px-2 text-xs" onClick={() => onSelect(target)}>Show</button></div>)}<button type="button" className="rounded border p-2" disabled={busy} onClick={() => void runProposal({ ...proposal.choices, [proposal.question!.index]: proposal.question!.choices.map(target => target.id) })}>Apply to all these matches</button></div>}
      {proposal?.confirmation && <div className="my-3 rounded-lg border border-amber-300 p-3 text-sm"><p>{proposal.plan.message}</p><p className="mt-2">{proposal.confirmation}</p><button type="button" disabled={busy} className="mt-2 rounded bg-violet-700 px-3 py-2 text-white" onClick={() => void runProposal(proposal.choices, true)}>Confirm change</button><button type="button" className="ml-3 underline" onClick={() => { void finish(proposal.job); setProposal(undefined); say('Cancelled. No changes applied.') }}>Cancel</button></div>}
      {tool === 'image' && <div className="my-3 rounded border p-3 text-xs"><p className="mb-2 font-semibold">Choose an image, then tell me where to use it</p><ImageField projectId={projectId} imageUrls={imageUrls} value={imageUrl} onChange={url => { setImageUrl(url); say(url ? 'Image attached. Tell me which image to replace or which section should use it.' : 'Image attachment cleared.') }} /></div>}
      {(tool === 'page' || tool === 'blog') && <ContentCreatePanel key={tool} initialKind={tool} openRequest={1} projectId={projectId} model={model} imageUrls={imageUrls} onSelect={onPageSelect} />}
    </div>
    <div className="border-t p-3">
      <div className="mb-2 flex items-center gap-2"><button type="button" aria-label="Assistant add menu" aria-expanded={menu} className="rounded border px-3 py-1 text-xl" onClick={() => setMenu(!menu)}>+</button>{menu && <div className="flex flex-wrap gap-1 text-xs">{([['page', 'New page'], ['blog', 'New blog'], ['image', 'Upload / choose image']] as const).map(([kind, title]) => <button key={kind} type="button" className="rounded border p-2" onClick={() => { setTool(kind); setMenu(false) }}>{title}</button>)}</div>}<button type="button" className="ml-auto text-xs underline disabled:opacity-40" disabled={!canUndo || busy} onClick={() => { onUndo(); say('Undid the most recent editor change.') }}>Undo last edit</button></div>
      {tool && <button type="button" className="mb-2 text-xs underline" onClick={() => setTool(undefined)}>Close {tool === 'image' ? 'image picker' : 'creation form'}</button>}
      {imageUrl && <p className="mb-2 text-xs text-violet-700">Image attached <button type="button" className="ml-2 underline" onClick={() => setImageUrl('')}>Remove</button></p>}
      <textarea aria-label="Instruction for this page" value={instruction} onChange={event => setInstruction(event.target.value)} maxLength={4000} rows={3} placeholder="What would you like to change on this page?" className="w-full resize-none rounded-lg border p-2 text-sm" onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send() } }} />
      {error && <ErrorNotice code="WT-CONTENT-001" message={error} className="my-2 text-xs text-red-700" />}
      <div className="mt-2 flex items-center justify-between gap-2"><span className="text-[11px] text-neutral-500">Draft edits · Save to update Preview</span><button type="button" disabled={busy || !instruction.trim()} className="rounded bg-violet-700 px-4 py-2 text-sm text-white disabled:opacity-40" onClick={() => void send()}>{busy ? 'Working…' : 'Send'}</button></div>
    </div>
  </aside>
}
