'use client'
import { ErrorNotice } from '@/components/error-notice'

import { mergeAssistantChanges, sameEditorValue } from '@/lib/assistant-merge'
import { PageAssistantDrawer } from './page-assistant-drawer'
import { applyMultiAction } from '@/lib/multi-object-editing'
import { editObjectProps, moveObject, objectScope, restoreMovedSection } from '@/lib/object-editing'
import { IntegrationsPanel, ScriptFields } from './integrations-panel'
import { duplicateElement, duplicableElement } from '@/lib/duplicate-element'
import { revealEditorElement } from '@/lib/reveal-editor-element'
import { HeaderMenuBehavior } from '@/components/header-menu-behavior'
import { SectionReorderList } from './section-reorder-list'
import { reorderSections } from '@/lib/section-order'
import { HeaderThemeControls } from './header-theme-controls'
import { ThemeLogoUpload } from './theme-logo-upload'
import { applySitePalette } from '@/lib/site-palette'
import { AddObjectDialog } from './add-object-dialog'
import { addManualObject } from '@/lib/add-manual-object'
import { ColorInput } from './color-input'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { flushSync } from 'react-dom'
import { flushInlineTextEdits, hasActiveInlineEdit } from './inline-edit'
import { getComponent, listComponents, normalizeHeroSettings } from '@awb/component-registry'
import type { ComponentFamily } from '@awb/component-registry'
import type { DesignTokens, WebsiteModel, WebsiteSection } from '@awb/website-model'
import { askAiForSection, generateAiSection, saveModel } from '@/app/actions/editor'
import { resolveSectionMedia } from '@/lib/section-media'
import { resolveEditorMedia } from '@/lib/editor-media'
import { setAtPointer } from '@/lib/json-pointer'
import { EditorCanvas, type Selection, type Viewport } from './editor-canvas'
import { PageRewritePanel } from './page-rewrite-panel'
import { ContentJobNotifications } from '@/components/content-job-notifications'
import { PageSelector } from './page-selector'
import { ContentCreatePanel } from './content-create-panel'
import { addContentPage } from '@/lib/content-creation'
import { sectionElementTree } from '@/lib/element-tree'
import { ElementTree } from './element-tree'
import { SpacingProperties } from './spacing-properties'
import { Inspector } from './inspector'

interface History {
  past: WebsiteModel[]
  present: WebsiteModel
  future: WebsiteModel[]
}

const families: ComponentFamily[] = [
  'HERO',
  'SERVICES',
  'ABOUT',
  'GALLERY',
  'PORTFOLIO',
  'CREDENTIALS',
  'REVIEWS',
  'FAQ',
  'CONTACT',
  'CTA',
]

export function EditorShell({ projectId, initialModel, imageUrls: initialImageUrls }: { projectId: string; initialModel: WebsiteModel; imageUrls: Record<string, string> }) {
  const [uploadedImageUrls, setUploadedImageUrls] = useState<Record<string, string>>({})
  const imageUrls = useMemo(() => ({ ...initialImageUrls, ...uploadedImageUrls }), [initialImageUrls, uploadedImageUrls])
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [history, setHistory] = useState<History>({ past: [], present: initialModel, future: [] })
  const [pageId, setPageId] = useState(initialModel.pages[0]!.id)
  const [selection, setSelection] = useState<Selection>()
  const [selectionMode, setSelectionMode] = useState(false)
  const [leftPanelOpen, setLeftPanelOpen] = useState(true)
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const [viewport, setViewport] = useState<Viewport>('desktop')
  const [panel, setPanel] = useState<'section' | 'theme' | 'page' | 'integrations'>('section')
  const [saving, setSaving] = useState(false)
  const [createContentRequest, setCreateContentRequest] = useState(0)
  const [saveError, setSaveError] = useState<string>()
  const [savedAt, setSavedAt] = useState<Date>()
  const [dirty, setDirty] = useState(false)
  const [addingObject, setAddingObject] = useState(false)
  const [adding, setAdding] = useState(false)
  const [generateContent, setGenerateContent] = useState(true)
  const [sectionTopic, setSectionTopic] = useState('')
  const [sectionRequest, setSectionRequest] = useState('')
  const [generatingSection, setGeneratingSection] = useState(false)
  const [sectionError, setSectionError] = useState<string>()
  const [insertIndex, setInsertIndex] = useState<number>()

  const model = history.present
  const latestModel = useRef(model)
  useLayoutEffect(() => { latestModel.current = model }, [model])
  useEffect(() => {
    const markDirty = () => setDirty(true)
    window.addEventListener('awb-inline-input', markDirty)
    return () => window.removeEventListener('awb-inline-input', markDirty)
  }, [])

  useEffect(() => {
    const open = (event: Event) => { const detail = (event as CustomEvent<{ pageId?: string }>).detail; if (detail?.pageId) { setPageId(detail.pageId); setSelection(undefined) }; setAssistantOpen(true) }
    window.addEventListener('awb-open-assistant', open)
    return () => window.removeEventListener('awb-open-assistant', open)
  }, [])

  const displayModel = useMemo(() => resolveEditorMedia(model, imageUrls), [model, imageUrls])
  const page = model.pages.find((candidate) => candidate.id === pageId) ?? model.pages[0]!
  const pageIndex = model.pages.indexOf(page)
  const selectedSectionId = selection?.kind === 'section' ? selection.id : undefined
  const globalSlot = selection && selection.kind !== 'section' ? selection.kind : undefined
  const section = page.sections.find((candidate) => candidate.id === selectedSectionId)
  const sectionIndex = section ? page.sections.indexOf(section) : -1
  const globalComponent = globalSlot ? model.globalComponents[globalSlot] : undefined
  const definition = section
    ? getComponent(section.componentId)
    : globalComponent
      ? getComponent(globalComponent.componentId)
      : undefined

  const selectSection = useCallback((id?: string) => {
    setSelection(id ? { kind: 'section', id } : undefined)
  }, [])

  const commit = useCallback((next: WebsiteModel) => {
    setHistory((current) => ({ past: [...current.past, current.present].slice(-50), present: next, future: [] }))
    setDirty(true)
  }, [])

  const undo = useCallback(() => {
    setHistory((current) => {
      const previous = current.past[current.past.length - 1]

      if (!previous) {
        return current
      }

      return { past: current.past.slice(0, -1), present: previous, future: [current.present, ...current.future] }
    })
    setDirty(true)
  }, [])

  const redo = useCallback(() => {
    setHistory((current) => {
      const next = current.future[0]

      if (!next) {
        return current
      }

      return { past: [...current.past, current.present], present: next, future: current.future.slice(1) }
    })
    setDirty(true)
  }, [])

  const save = useCallback(async () => {
    flushSync(() => flushInlineTextEdits())
    const snapshot = latestModel.current
    setSaving(true)
    setSaveError(undefined)

    try {
      await saveModel(projectId, snapshot)
      setSavedAt(new Date())
      if (latestModel.current === snapshot && !hasActiveInlineEdit()) setDirty(false)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }, [projectId])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey)) {
        return
      }

      if (event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
      }

      if (event.key.toLowerCase() === 's') {
        event.preventDefault()
        void save()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo, redo, save])

  async function addGeneratedSection(componentId: string, instruction: string) {
    setGeneratingSection(true)
    setSectionError(undefined)
    const targetPageId = page.id
    const position = insertIndex
    try {
      await generateAiSection(projectId, { model, pageId: targetPageId, componentId, instruction, insertIndex: position })
      window.dispatchEvent(new Event('awb-content-queued'))
      setAdding(false)
      setInsertIndex(undefined)
      setSectionRequest('')
    } catch (error) {
      setSectionError(error instanceof Error ? error.message : 'Could not generate the section. Please try again.')
    } finally {
      setGeneratingSection(false)
    }
  }

  const updateSections = (updater: (sections: WebsiteSection[]) => WebsiteSection[]) => {
    commit(setAtPointer(model, `/pages/${pageIndex}/sections`, updater(page.sections)))
  }

  const variants = definition ? listComponents(definition.family).map((candidate) => ({
    componentId: candidate.componentId,
    name: candidate.name,
    description: candidate.description,
  })) : []

  return (
    <div className="flex h-screen flex-col bg-neutral-100">
      <header className="flex shrink-0 flex-nowrap items-center justify-between gap-3 overflow-x-auto border-b border-neutral-200 bg-white px-4 py-2">
        <div className="flex shrink-0 items-center gap-3">
          <Link href="/dashboard" className="text-sm text-neutral-500 hover:underline">
            ← Websites
          </Link>
          <span className="max-w-28 truncate text-sm font-semibold" title={model.site.name}>{model.site.name}</span>
          <PageSelector pages={model.pages} page={page} onChange={(id) => { setPageId(id); setSelection(undefined) }} />
          <button type="button" aria-expanded={assistantOpen} className="whitespace-nowrap rounded-md bg-violet-700 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-800" onClick={() => setAssistantOpen(!assistantOpen)}>✦ AI Assistant</button>
          <button type="button" className="whitespace-nowrap rounded-md bg-violet-700 px-3 py-1.5 text-sm font-medium text-white" onClick={() => { setRightPanelOpen(true); setPanel('page'); setCreateContentRequest((value) => value + 1) }}>+ Blog / Page</button>
        </div>

        <div className="flex shrink-0 items-center gap-1 rounded-md border border-neutral-200 p-0.5 text-xs">
          {(['desktop', 'tablet', 'mobile'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setViewport(option)}
              className={`rounded px-2 py-1 capitalize ${viewport === option ? 'bg-neutral-900 text-white' : 'text-neutral-600'}`}
            >
              {option}
            </button>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2 whitespace-nowrap text-sm">
          <button type="button" onClick={undo} disabled={history.past.length === 0} className={ghostButton}>
            Undo
          </button>
          <button type="button" onClick={redo} disabled={history.future.length === 0} className={ghostButton}>
            Redo
          </button>
          <Link href={`/preview/${projectId}${page.path === '/' ? '' : page.path}`} target="_blank" className={ghostButton}>
            Preview
          </Link>
          <a href={`/projects/${projectId}/publishing`} className={ghostButton}>Domains & Publish</a>
          <button type="button" onClick={save} disabled={saving || !dirty} className={primaryButton}>
            {saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}
          </button>
        </div>
      </header>

      {!assistantOpen && <button type="button" aria-label="Open AI Assistant" onClick={() => setAssistantOpen(true)} className="fixed bottom-5 right-5 z-[850] flex items-center gap-2 rounded-full bg-violet-700 px-5 py-3 text-sm font-semibold text-white shadow-xl ring-2 ring-white hover:bg-violet-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700"><span aria-hidden="true">✦</span> AI Assistant</button>}
      <PageAssistantDrawer key={page.id} open={assistantOpen} onClose={() => setAssistantOpen(false)} projectId={projectId} pageId={page.id} model={model} imageUrls={imageUrls} canUndo={history.past.length > 0} onUndo={undo} onPageSelect={id => { setPageId(id); setSelection(undefined) }} selection={selection ? { scope: selection.kind === 'section' ? 'page' : selection.kind, sectionId: selection.kind === 'section' ? selection.id : selection.kind, paths: selection.kind === 'section' && selection.elements?.length ? selection.elements : selection.element ? [selection.element] : [] } : undefined} onApply={(next, baseline) => {
        flushSync(() => flushInlineTextEdits())
        commit(mergeAssistantChanges(baseline, next, latestModel.current))
      }} onSelect={target => { setSelection(target.scope === 'page' ? { kind: 'section', id: target.sectionId, ...(target.path ? { element: target.path } : {}) } : { kind: target.scope, ...(target.path ? { element: target.path } : {}) }); revealEditorElement(target.path || undefined) }} />
      <ContentJobNotifications projectId={projectId} onApply={(detail) => {
        if (detail.kind === 'CREATE') {
          const created = (detail.result as unknown as { page: typeof page }).page
          const alreadyAdded = model.pages.find((entry) => entry.id === created.id && entry.path === created.path)
          if (alreadyAdded) { setPageId(alreadyAdded.id); setSelection(undefined); return }
          commit(addContentPage(model, created)); setPageId(created.id); setSelection(undefined)
        } else if (detail.kind === 'REWRITE') {
          const existing = model.pages.find((entry) => entry.id === detail.pageId)
          if (!existing || !sameEditorValue(existing, detail.originalPage)) throw new Error('This page changed while AI was working. Start a new rewrite to preserve your latest edits.')
          const rewritten = (detail.result as unknown as { page: typeof page }).page
          commit({ ...model, pages: model.pages.map((entry) => entry.id === detail.pageId ? rewritten : entry) }); setPageId(rewritten.id)
        } else if (detail.kind === 'PATCH') {
          const existing = model.pages.find((entry) => entry.id === detail.pageId)?.sections.find((entry) => entry.id === detail.sectionId)
          if (!existing || !sameEditorValue(existing, detail.originalSection)) throw new Error('This section changed while AI was working. Request a new edit to preserve your changes.')
          const generated = detail.result as unknown as WebsiteSection
          commit({ ...model, pages: model.pages.map((entry) => entry.id === detail.pageId ? { ...entry, sections: entry.sections.map((section) => section.id === detail.sectionId ? generated : section) } : entry) })
        } else if (detail.kind === 'SECTION') {
          const existing = model.pages.find((entry) => entry.id === detail.pageId)
          const generated = detail.result as unknown as WebsiteSection
          if (!existing) throw new Error('The destination page no longer exists.')
          if (existing.sections.some((entry) => entry.id === generated.id)) throw new Error('This section is already added. Save to keep it.')
          const sections = [...existing.sections]; sections.splice(detail.insertIndex ?? sections.length, 0, generated)
          commit({ ...model, pages: model.pages.map((entry) => entry.id === existing.id ? { ...entry, sections } : entry) }); setPageId(existing.id); setSelection({ kind: 'section', id: generated.id })
        }
      }} />

      <div className="flex items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 py-1.5" role="group" aria-label="Editor workspace panels">
        <PanelToggle side="left" label="Sections" open={leftPanelOpen} onClick={() => setLeftPanelOpen((open) => !open)} />
        <button type="button" aria-pressed={selectionMode} title="Drag a rectangle around objects in one section. You can also Shift-drag." onClick={() => setSelectionMode((value) => !value)} className={`rounded-md border px-2.5 py-1.5 text-xs ${selectionMode ? 'border-sky-400 bg-sky-50 text-sky-800' : 'border-neutral-200 text-neutral-600'}`}>▧ Select area</button>
        <button type="button" className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100" aria-pressed={!leftPanelOpen && !rightPanelOpen} onClick={() => { const open = !leftPanelOpen && !rightPanelOpen; setLeftPanelOpen(open); setRightPanelOpen(open) }}>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" /></svg>
          {!leftPanelOpen && !rightPanelOpen ? 'Show panels' : 'Focus canvas'}
        </button>
        <PanelToggle side="right" label="Properties" open={rightPanelOpen} onClick={() => setRightPanelOpen((open) => !open)} />
      </div>

      {saveError && <ErrorNotice code="WT-EDITOR-001" message={saveError} className="bg-red-50 px-4 py-2 text-sm text-red-700" />}
      {savedAt && !dirty && (
        <p className="bg-emerald-50 px-4 py-1 text-xs text-emerald-800">
          Saved as a new version at {savedAt.toLocaleTimeString()} — earlier versions stay restorable.
        </p>
      )}

      <div className="grid min-h-0 flex-1" style={{ gridTemplateColumns: `${leftPanelOpen ? '260px ' : ''}minmax(0,1fr)${rightPanelOpen ? ' 320px' : ''}` }}>
        <aside id="editor-left-panel" aria-label="Sections and elements" className="flex min-h-0 flex-col overflow-y-auto border-r border-neutral-200 bg-white" style={{ display: leftPanelOpen ? undefined : 'none' }}>
          <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
            <button type="button" title="Collapse sections panel" aria-label="Collapse sections panel" onClick={() => setLeftPanelOpen(false)} className="flex items-center gap-2 text-xs uppercase tracking-widest text-neutral-500 hover:text-neutral-900"><span aria-hidden="true">‹</span> Sections</button>
            <button
              type="button"
              className="text-xs text-sky-700 hover:underline"
              onClick={() => {
                setInsertIndex(undefined)
                setAdding((value) => !value)
              }}
            >
              + Add section
            </button>
          </div>

          <button type="button" className="mx-3 my-2 rounded-md border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-900" onClick={() => setAddingObject(true)}>+ Add object</button>

          <div className="grid shrink-0 gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-3">
            <span className="text-xs font-semibold text-neutral-700">Editing page</span>
            <PageSelector pages={model.pages} page={page} onChange={(id) => { setPageId(id); setSelection(undefined); setAdding(false); setInsertIndex(undefined); setPanel('section') }} />
            <span className="break-all text-xs text-neutral-500">{page.path}</span>
            {page.path !== '/' && model.pages.some(entry => entry.path === '/') && <button type="button" className="text-left text-xs font-medium text-sky-700 underline" onClick={() => { setPageId(model.pages.find(entry => entry.path === '/')!.id); setSelection(undefined); setAdding(false); setInsertIndex(undefined); setPanel('section') }}>Show Home page sections</button>}
            <p className="text-xs font-semibold text-neutral-700">Sections on this page ({page.sections.length})</p>
          </div>

          {adding && (
            <div className="border-b border-neutral-200 p-3">
              <h3 className="text-sm font-semibold">Add a new section</h3>
              <button type="button" className="mt-3 w-full rounded-md border border-violet-400 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-900" onClick={() => {
                const blank: WebsiteSection = { id: `section-${crypto.randomUUID()}`, componentId: 'ManualSection', componentVersion: '1.0.0', hidden: false, props: { items: [] } }
                const sections = [...page.sections]; sections.splice(insertIndex ?? sections.length, 0, blank)
                commit({ ...model, pages: model.pages.map(entry => entry.id === page.id ? { ...entry, sections } : entry) })
                setSelection({ kind: 'section', id: blank.id }); setAdding(false); setRightPanelOpen(true); setPanel('section')
              }}>+ Blank section — build without AI</button>
              <div className="my-3 grid gap-2">{['PortfolioShowcase', 'CredentialsShowcase'].map(componentId => <button key={componentId} type="button" className="rounded-md border border-sky-300 bg-sky-50 px-3 py-2 text-left text-xs text-sky-950" onClick={() => { const definition = getComponent(componentId)!; const section: WebsiteSection = { id: `section-${crypto.randomUUID()}`, componentId, componentVersion: definition.version, hidden: false, props: structuredClone(definition.fixture) as Record<string, unknown> }; const sections = [...page.sections]; sections.splice(insertIndex ?? sections.length, 0, section); commit({ ...model, pages: model.pages.map(entry => entry.id === page.id ? { ...entry, sections } : entry) }); setSelection({ kind: 'section', id: section.id }); setAdding(false); setRightPanelOpen(true); setPanel('section') }}>+ {componentId === 'PortfolioShowcase' ? 'Portfolio / products — add your work' : 'Credentials / awards — upload badges'}</button>)}</div><p className="mt-1 text-xs text-neutral-500">Page: {page.title}. Your existing sections stay in place.</p>
              <div className="my-3 grid grid-cols-2 gap-1 rounded-lg bg-neutral-100 p-1" role="group" aria-label="How to add a section">
                <button type="button" disabled={generatingSection} aria-pressed={generateContent} onClick={() => { setGenerateContent(true); setSectionError(undefined) }} className={`rounded-md px-2 py-2 text-xs ${generateContent ? 'bg-white font-semibold shadow-sm' : 'text-neutral-600'}`}>AI chooses layout</button>
                <button type="button" disabled={generatingSection} aria-pressed={!generateContent} onClick={() => { setGenerateContent(false); setSectionError(undefined) }} className={`rounded-md px-2 py-2 text-xs ${!generateContent ? 'bg-white font-semibold shadow-sm' : 'text-neutral-600'}`}>I choose layout</button>
              </div>
              <label className="mb-3 grid gap-1 text-xs font-medium">Placement
                <select disabled={generatingSection} className="w-full rounded border border-neutral-300 p-2 text-xs" value={insertIndex ?? page.sections.length} onChange={(event) => setInsertIndex(Number(event.target.value))}>
                  <option value={0}>At the top of this page</option>
                  {page.sections.map((entry, index) => <option key={entry.id} value={index + 1}>After {String(entry.props.heading || getComponent(entry.componentId)?.name || `section ${index + 1}`)}</option>)}
                </select>
              </label>
              {generateContent ? <div className="grid gap-3">
                <fieldset disabled={generatingSection}>
                  <legend className="mb-2 text-xs font-semibold">1. What would you like to add?</legend>
                  <div className="grid gap-1">
                    {['About us / Who we are', 'Service areas', 'Our methodology / Approach', 'Why choose us', 'FAQ for this page', 'Portfolio / Product showcase', 'Credentials / Awards', 'Custom section'].map((topic) => <label key={topic} className={`flex cursor-pointer items-center gap-2 rounded-md border p-2 text-xs ${sectionTopic === topic ? 'border-sky-600 bg-sky-50' : 'border-neutral-200'}`}>
                      <input type="radio" name="new-section-topic" value={topic} checked={sectionTopic === topic} onChange={() => { setSectionTopic(topic); setSectionError(undefined) }} />{topic}
                    </label>)}
                  </div>
                </fieldset>
                <label className="grid gap-1 text-xs font-semibold">2. {sectionTopic === 'Custom section' ? 'Describe your section' : 'Add details (optional)'}
                  <textarea value={sectionRequest} maxLength={4000} disabled={generatingSection} onChange={(event) => setSectionRequest(event.target.value)} rows={4} className="w-full rounded border border-neutral-300 p-2 font-normal" placeholder="Example: Explain our approach in three steps: understand your needs, compare options, then help you apply." />
                </label>
                <p className="text-xs text-neutral-500">AI uses your business details, chooses a layout and writes the content. Add any facts or instructions you want included.</p>
                <button type="button" disabled={generatingSection || !sectionTopic || (sectionTopic === 'Custom section' && !sectionRequest.trim())} className="rounded-md bg-sky-700 px-3 py-2.5 text-sm font-medium text-white disabled:opacity-50" onClick={() => void addGeneratedSection(sectionTopic === 'FAQ for this page' ? 'FaqAccordion' : sectionTopic === 'Portfolio / Product showcase' ? 'PortfolioShowcase' : sectionTopic === 'Credentials / Awards' ? 'CredentialsShowcase' : 'auto', [sectionTopic, sectionRequest.trim()].filter(Boolean).join(': '))}>{generatingSection ? 'Creating your section…' : 'Generate section'}</button>
                {!sectionTopic && <p className="text-xs text-neutral-500">Select a topic to get started.</p>}
                {sectionTopic === 'Custom section' && !sectionRequest.trim() && <p className="text-xs text-neutral-500">Describe what you need before generating.</p>}
                <p className="text-xs text-neutral-500">3. Review the new section in the page, make any changes, then click Save.</p>
              </div> : <p className="mb-3 text-xs text-neutral-500">Choose a layout below. AI will write new content for your business and reuse relevant project images. Review the generated section, then Save.</p>}
              {generatingSection && <p role="status" className="mt-2 text-xs text-sky-700">Queuing your request. Content will appear in the notification bar when ready.</p>}
              {sectionError && <ErrorNotice code="WT-EDITOR-001" message={sectionError} className="my-2 text-xs text-red-700" />}
              {!generateContent && families.map((family) => {
                const options = listComponents(family)

                if (options.length === 0) {
                  return null
                }

                return (
                  <details key={family} className="mb-1">
                    <summary className="cursor-pointer text-xs font-medium text-neutral-700">{family}</summary>
                    <div className="mt-1 grid gap-1">
                      {options.map((option) => (
                        <button
                          key={option.componentId}
                          type="button"
                          className="rounded border border-neutral-200 px-2 py-1 text-left text-xs hover:border-neutral-400"
                          disabled={generatingSection}
                          onClick={() => void addGeneratedSection(option.componentId, sectionRequest)}
                        >
                          <span className="block font-medium">Generate {option.name}</span>
                          <span className="mt-1 block text-neutral-500">{option.description}</span>
                        </button>
                      ))}
                    </div>
                  </details>
                )
              })}
            </div>
          )}

          <SectionReorderList key={page.id} sections={page.sections} onReorder={(id, slot) => { const next = reorderSections(page.sections, id, slot); if (next !== page.sections) updateSections(() => next) }}>
            {(candidate, _index, dragging) => (
              <>
                <button
                  type="button"
                  onClick={() => {
                    selectSection(candidate.id)
                    revealEditorElement()
                    setPanel('section')
                  }}
                  className={`w-full rounded px-3 py-2 text-left text-sm ${
                    candidate.id === selectedSectionId ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-100'
                  }`}
                >
                  <span className="block text-[10px] uppercase tracking-wide opacity-60">Section {_index + 1} · {getComponent(candidate.componentId)?.name || candidate.componentId}</span>
                  <span className="block break-words">{String(candidate.props.heading || getComponent(candidate.componentId)?.name || candidate.componentId)}</span>
                  {candidate.hidden && <span className="ml-2 text-[10px] opacity-70">hidden</span>}
                </button>
                {!dragging && candidate.id === selectedSectionId && <ElementTree canDuplicate={(path) => !!duplicableElement(path, candidate.props) || /^\/(layout\/|freeElements\/\d+$|(?:points|items|testimonials)\/\d+$)/.test(path)} onDuplicate={(path) => {
                  const result = duplicateElement(candidate.props, path)
                  if (!result) {
                    const copy = moveObject(page.sections, candidate.id, path, candidate.id, { x: 5, y: 40, width: 45, height: 200 }, true)
                    if (copy) { updateSections(() => copy.sections); setSelection({ kind: 'section', id: candidate.id, element: copy.path }); setPanel('section'); revealEditorElement(copy.path) }
                    return
                  }
                  updateSections((sections) => sections.map((entry) => entry.id === candidate.id ? { ...entry, props: result.props } : entry))
                  setSelection({ kind: 'section', id: candidate.id, element: result.path }); setPanel('section'); revealEditorElement(result.path)
                }} nodes={sectionElementTree(candidate.componentId, candidate.props)} selected={selection?.kind === 'section' ? selection.element : undefined} onSelect={(element) => { setSelection({ kind: 'section', id: candidate.id, element }); setPanel('section'); revealEditorElement(element) }} />}
              </>
            )}
          </SectionReorderList>

          <div className="mt-auto grid gap-1 border-t border-neutral-200 p-2">
            <span className="px-3 pt-1 text-xs uppercase tracking-widest text-neutral-500">Global</span>
            {(['header', 'footer'] as const).map((slot) => (
              <div key={slot}><button
                key={slot}
                type="button"
                onClick={() => {
                  setSelection({ kind: slot })
                  revealEditorElement()
                  setPanel('section')
                }}
                className={`w-full rounded px-3 py-2 text-left text-sm capitalize ${
                  selection?.kind === slot ? 'bg-violet-700 text-white' : 'hover:bg-neutral-100'
                }`}
              >
                {getComponent(model.globalComponents[slot].componentId)?.name ?? slot}
              </button>
              {selection?.kind === slot && <ElementTree nodes={sectionElementTree(model.globalComponents[slot].componentId, model.globalComponents[slot].props)} selected={selection.element} onSelect={(element) => { setSelection({ kind: slot, element }); setPanel('section'); revealEditorElement(element) }} />}
              </div>
            ))}
          </div>
        </aside>

        {addingObject && <AddObjectDialog sections={page.sections.filter(entry => !entry.hidden).map(entry => ({ id: entry.id, label: String(entry.props.heading || getComponent(entry.componentId)?.name || 'Section') }))} initialSectionId={section && !section.hidden ? section.id : undefined} onClose={() => setAddingObject(false)} onAdd={(kind, targetId) => {
          const target: WebsiteSection | undefined = targetId === 'new' ? { id: `section-${crypto.randomUUID()}`, componentId: 'ManualSection', componentVersion: '1.0.0', hidden: false, props: { items: [] } } : page.sections.find(entry => entry.id === targetId)
          if (!target || target.hidden) throw new Error('Choose a visible section.')
          const frame = Array.from(document.querySelectorAll<HTMLElement>('[data-awb-section-id]')).find(entry => entry.dataset.awbSectionId === target.id)
          const added = addManualObject(target, kind, crypto.randomUUID(), frame?.offsetHeight ?? 400)
          const sections = targetId === 'new' ? [...page.sections, added.section] : page.sections.map(entry => entry.id === target.id ? added.section : entry)
          commit({ ...model, pages: model.pages.map(entry => entry.id === page.id ? { ...entry, sections } : entry) })
          setSelection({ kind: 'section', id: target.id, element: added.path }); setPanel('section'); setRightPanelOpen(true)
          requestAnimationFrame(() => revealEditorElement(added.path))
        }} />}

        <HeaderMenuBehavior />
        <EditorCanvas
          selectionMode={selectionMode}
          onAreaSelect={(id, paths) => { setSelection({ kind: 'section', id, element: paths[paths.length - 1], elements: paths }); setSelectionMode(false) }}
          onMultiAction={(id, action) => {
            const sourceSections = action.type === 'resize' ? page.sections.map((entry) => entry.id === id ? { ...entry, props: resolveSectionMedia(model, page, entry) } : entry) : page.sections
            const next = applyMultiAction(sourceSections, id, action)
            if (next === sourceSections) return
            updateSections(() => next)
            if (action.type === 'resize') {
              const source = sourceSections.find((entry) => entry.id === id)!
              let index = (source.props.freeElements as unknown[] | undefined)?.length ?? 0
              const paths = action.items.map((item) => { const scope = objectScope(source.props, item.path); return scope.root ? `/freeElements/${scope.index}` : `/freeElements/${index++}` })
              setSelection({ kind: 'section', id, element: paths[paths.length - 1], elements: paths })
            }
            if (action.type === 'delete') setSelection({ kind: 'section', id })
          }}
          projectId={projectId}
          imageUrls={imageUrls}
          onObjectAction={(target, path, action) => {
            if (target.kind !== 'section') {
              const props = model.globalComponents[target.kind].props
              commit(setAtPointer(model, `/globalComponents/${target.kind}/props`, editObjectProps(props, path, action)))
              if (action.type === 'delete') setSelection({ kind: target.kind })
              return
            }
            if (action.type === 'restoreSection') {
              const id = `section-${crypto.randomUUID()}`
              const next = restoreMovedSection(page.sections, target.id, path, id)
              if (next !== page.sections) {
                updateSections(() => next)
                setSelection({ kind: 'section', id })
              }
              return
            }
            if (action.type === 'move' && (action.sourcePath ?? path) === '/layout/0' && action.targetId !== target.id) {
              const destination = page.sections.findIndex((entry) => entry.id === action.targetId)
              const source = page.sections.findIndex((entry) => entry.id === target.id)
              if (destination >= 0) updateSections(() => reorderSections(page.sections, target.id, destination + (source < destination ? 1 : 0)))
              setSelection({ kind: 'section', id: target.id })
              return
            }
            if (action.type === 'move' || action.type === 'duplicate') {
              const targetId = action.type === 'move' ? action.targetId : target.id
              // Freeze resolved canonical images into the snapshot before detaching.
              // Display-model URLs may be temporary signed/proxy URLs.
              const sourceSections = page.sections.map((entry) => entry.id === target.id ? { ...entry, props: resolveSectionMedia(model, page, entry) } : entry)
              const result = moveObject(sourceSections, target.id, action.type === 'move' ? action.sourcePath ?? path : path, targetId, action.placement, action.type === 'duplicate', action.type === 'move' ? action.sourceSlot : undefined, action.type === 'move' ? action.offset : undefined)
              if (result) {
                updateSections(() => result.sections)
                setSelection({ kind: 'section', id: targetId, element: action.type === 'move' && targetId === target.id && action.sourcePath === result.path ? path : result.path })
                // Canvas moves must not centre the viewport: a horizontal drag
                // otherwise makes every surrounding object appear to move up.
              } else setSaveError('This object could not be moved or duplicated. Select its parent block, or check that the destination has fewer than 100 moved objects.')
              return
            }
            updateSections((sections) => sections.map((entry) => entry.id === target.id ? { ...entry, props: editObjectProps(entry.props, path, action) } : entry))
            if (action.type === 'delete') setSelection({ kind: 'section', id: target.id })
          }}
          model={displayModel}
          page={displayModel.pages.find((candidate) => candidate.id === page.id)!}
          viewport={viewport}
          selection={selection}
          onSelect={(next) => {
            setSelection(next)
            if (next) setPanel('section')
          }}
          onResizeText={(id, path, style) => updateSections((sections) => sections.map((entry) => entry.id === id ? { ...entry, props: /^\/freeElements\/\d+$/.test(path) ? editObjectProps(entry.props, path, { type: 'placement', value: style }) : editObjectProps(entry.props, path, { type: 'style', value: style }) } : entry))}
          onResizeImage={(id, path, size) => updateSections((sections) => sections.map((entry) => entry.id === id ? { ...entry, props: editObjectProps(entry.props, path, { type: 'imageSize', value: size }) } : entry))}
          onMoveSection={(id, direction) =>
            updateSections((sections) => {
              const from = sections.findIndex((candidate) => candidate.id === id)
              const to = from + direction

              if (from < 0 || to < 0 || to >= sections.length) {
                return sections
              }

              const next = [...sections]
              const [moved] = next.splice(from, 1)
              next.splice(to, 0, moved!)
              return next
            })
          }
          onDuplicateSection={(id) =>
            updateSections((sections) => {
              const index = sections.findIndex((candidate) => candidate.id === id)
              const original = sections[index]

              if (!original) {
                return sections
              }

              const copy: WebsiteSection = {
                ...structuredClone(original),
                id: `section-${Math.random().toString(36).slice(2, 9)}`,
              }
              const next = [...sections]
              next.splice(index + 1, 0, copy)
              return next
            })
          }
          onDeleteSection={(id) => {
            updateSections((sections) => sections.filter((candidate) => candidate.id !== id))
            setSelection(undefined)
          }}
          onToggleHidden={(id) =>
            updateSections((sections) =>
              sections.map((candidate) =>
                candidate.id === id ? { ...candidate, hidden: !candidate.hidden } : candidate,
              ),
            )
          }
          onEditText={(target, pointer, value) => {
            setHistory(current => {
              let root: string
              if (target.kind !== 'section') root = `/globalComponents/${target.kind}/props`
              else {
                const targetPage = current.present.pages.findIndex(entry => entry.sections.some(item => item.id === target.id))
                if (targetPage < 0) return current
                const targetSection = current.present.pages[targetPage]!.sections.findIndex(item => item.id === target.id)
                root = `/pages/${targetPage}/sections/${targetSection}/props`
              }
              const next = setAtPointer(current.present, `${root}${pointer}`, value)
              return { past: [...current.past, current.present].slice(-50), present: next, future: [] }
            })
            setDirty(true)
          }}
          onReorder={(sourceId, targetIndex) =>
            updateSections((sections) => {
              const from = sections.findIndex((candidate) => candidate.id === sourceId)

              if (from < 0) {
                return sections
              }

              const next = [...sections]
              const [moved] = next.splice(from, 1)
              next.splice(from < targetIndex ? targetIndex - 1 : targetIndex, 0, moved!)
              return next
            })
          }
          onInsertAfter={(id) => {
            setInsertIndex(page.sections.findIndex((candidate) => candidate.id === id) + 1)
            setAdding(true)
            setLeftPanelOpen(true)
          }}
        />

        <aside id="editor-right-panel" aria-label="Properties" className="flex min-h-0 flex-col border-l border-neutral-200 bg-white" style={{ display: rightPanelOpen ? undefined : 'none' }}>
          <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2">
            <span className="text-xs uppercase tracking-widest text-neutral-500">Properties</span>
            <button type="button" title="Collapse properties panel" aria-label="Collapse properties panel" onClick={() => setRightPanelOpen(false)} className="rounded px-2 py-1 text-neutral-500 hover:bg-neutral-100">›</button>
          </div>
          <nav className="flex border-b border-neutral-200 text-xs">
            {(['section', 'page', 'theme', 'integrations'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setPanel(tab)}
                className={`flex-1 px-3 py-2 capitalize ${panel === tab ? 'border-b-2 border-neutral-900 font-medium' : 'text-neutral-500'}`}
              >
                {tab}
              </button>
            ))}
          </nav>

          {panel === 'section' && selection?.kind === 'section' && (selection.elements?.length ?? 0) > 1 && <div className="p-4 text-sm text-neutral-600"><p className="font-semibold text-neutral-900">{selection.elements!.length} objects selected</p><p className="mt-2">Use the floating toolbar to edit compatible properties together, group objects, or move the selection. Shift-click an object to add or remove it.</p></div>}
          {panel === 'section' && selection?.kind === 'section' && (selection.elements?.length ?? 0) > 1 && section && <SpacingProperties paths={selection.elements!} props={section.props} onChange={(value) => updateSections((sections) => applyMultiAction(sections, section.id, { type: 'style', paths: selection.elements!, value }))} />}
          {panel === 'section' && !(selection?.kind === 'section' && (selection.elements?.length ?? 0) > 1) &&
            (section && definition ? (
              <Inspector
                imageUrls={imageUrls}
                projectId={projectId}
                componentName={definition.name}
                onDeleteSection={() => { updateSections((sections) => sections.filter((entry) => entry.id !== section.id)); setSelection(undefined) }}
                selectedElement={selection?.kind === 'section' ? selection.element : undefined}
                onSelectElement={(element) => setSelection({ kind: 'section', id: section.id, ...(element ? { element } : {}) })}
                fields={definition.editorFields}
                props={resolveSectionMedia(model, page, section)}
                currentComponentId={section.componentId}
                variants={variants}
                hidden={section.hidden}
                onToggleHidden={() =>
                  commit(setAtPointer(model, `/pages/${pageIndex}/sections/${sectionIndex}/hidden`, !section.hidden))
                }
                onSwitchVariant={(componentId) => {
                  const target = getComponent(componentId)

                  if (!target) {
                    return
                  }

                  /// Keep whatever props the new component understands, fall back
                  /// to its fixture for anything it needs and we do not have.
                  const merged = target.propsSchema.safeParse(section.props)
                  const props = merged.success ? section.props : (structuredClone(target.fixture) as Record<string, unknown>)

                  commit(
                    setAtPointer(model, `/pages/${pageIndex}/sections/${sectionIndex}`, {
                      ...section,
                      componentId,
                      componentVersion: target.version,
                      variantOf: section.componentId,
                      props,
                    }),
                  )
                }}
                onChange={(pointer, value) => {
                  const root = `/pages/${pageIndex}/sections/${sectionIndex}/props`
                  const base = definition.family === 'HERO' ? setAtPointer(model, root, normalizeHeroSettings(section.props)) : model
                  let next = setAtPointer(base, `${root}${pointer}`, value)
                  if (definition.family === 'HERO' && pointer === '/imageLayout') next = setAtPointer(next, `${root}/sectionBackgroundMode`, 'original')
                  commit(next)
                }}
                onAskAi={async (instruction) => {
                  await askAiForSection(projectId, { model, pageId: page.id, sectionId: section.id, instruction })
                  window.dispatchEvent(new Event('awb-content-queued'))
                }}
              />
            ) : globalSlot && globalComponent && definition ? (
              <Inspector
                imageUrls={imageUrls}
                projectId={projectId}
                kind={`Global ${globalSlot}`}
                selectedElement={selection?.kind === globalSlot ? selection.element : undefined}
                onSelectElement={(element) => setSelection({ kind: globalSlot, element })}
                componentName={definition.name}
                fields={definition.editorFields}
                props={globalComponent.props}
                currentComponentId={globalComponent.componentId}
                variants={variants}
                onSwitchVariant={(componentId) => {
                  const target = getComponent(componentId)

                  if (!target) {
                    return
                  }

                  const merged = target.propsSchema.safeParse(globalComponent.props)
                  const props = merged.success
                    ? globalComponent.props
                    : (structuredClone(target.fixture) as Record<string, unknown>)

                  commit(
                    setAtPointer(model, `/globalComponents/${globalSlot}`, {
                      ...globalComponent,
                      componentId,
                      componentVersion: target.version,
                      props,
                    }),
                  )
                }}
                onChange={(pointer, value) => {
                  const root = `/globalComponents/${globalSlot}/props`
                  let next = setAtPointer(model, `${root}${pointer}`, value)
                  if (globalSlot === 'header' && pointer.startsWith('/sectionBackground')) {
                    next = setAtPointer(next, `${root}/customBackground`, false)
                    if (pointer === '/sectionBackgroundColor' && globalComponent.props.sectionBackgroundMode !== 'image') next = setAtPointer(next, `${root}/sectionBackgroundMode`, 'colour')
                  }
                  if (globalSlot === 'header' && (pointer === '/backgroundColor' || (pointer === '/customBackground' && value === true))) {
                    next = setAtPointer(next, `${root}/customBackground`, true)
                    next = setAtPointer(next, `${root}/sectionBackgroundMode`, 'original')
                  }
                  commit(next)
                }}
              />
            ) : (
              <p className="p-4 text-sm text-neutral-500">Select a section on the canvas to edit it.</p>
            ))}

          {panel === 'page' && (
            <div className="grid gap-3 overflow-y-auto p-4">
              <ContentCreatePanel imageUrls={imageUrls} openRequest={createContentRequest} projectId={projectId} model={model} onSelect={(id) => { setPageId(id); setSelection(undefined) }} />
              <PageRewritePanel key={page.id} projectId={projectId} model={model} page={page} onApply={(rewritten) => commit(setAtPointer(model, `/pages/${pageIndex}`, rewritten))} />
              <Text
                label="Page title"
                value={page.title}
                onChange={(value) => commit(setAtPointer(model, `/pages/${pageIndex}/title`, value))}
              />
              <Text
                label="H1"
                value={page.h1}
                onChange={(value) => commit(setAtPointer(model, `/pages/${pageIndex}/h1`, value))}
              />
              <Text
                label="SEO title"
                value={page.seo.title}
                onChange={(value) => commit(setAtPointer(model, `/pages/${pageIndex}/seo/title`, value))}
              />
              <label className="grid gap-1">
                <span className="text-xs font-medium text-neutral-700">Meta description</span>
                <textarea
                  rows={3}
                  className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
                  value={page.seo.description}
                  onChange={(event) => commit(setAtPointer(model, `/pages/${pageIndex}/seo/description`, event.target.value))}
                />
              </label>
              <Text
                label="Canonical path"
                value={page.seo.canonical ?? page.path}
                onChange={(value) => commit(setAtPointer(model, `/pages/${pageIndex}/seo/canonical`, value))}
              />
              <label className="flex items-center gap-2 text-xs text-neutral-700">
                <input
                  type="checkbox"
                  checked={page.seo.index}
                  onChange={(event) => commit(setAtPointer(model, `/pages/${pageIndex}/seo/index`, event.target.checked))}
                />
                Allow search engines to index this page
              </label>
            </div>
          )}

          {panel === 'page' && <div className="overflow-y-auto border-t p-4"><h3 className="mb-2 text-sm font-semibold">Scripts for this page</h3><ScriptFields value={page.customScripts} onChange={(value) => commit(setAtPointer(model, `/pages/${pageIndex}/customScripts`, value))} /></div>}
          {panel === 'integrations' && <IntegrationsPanel projectId={projectId} model={model} onChange={commit} />}
          {panel === 'theme' && (
            <ThemePanel logoUpload={<ThemeLogoUpload projectId={projectId} logoUrl={typeof model.globalComponents.header.props.logoImageUrl === 'string' ? model.globalComponents.header.props.logoImageUrl : undefined} onApplyPalette={(tokens) => commit(applySitePalette(latestModel.current, tokens.palette))} onUpload={(url) => {
              setUploadedImageUrls(current => ({ ...current, [url]: `/api/projects/${projectId}/editor-image?url=${encodeURIComponent(url)}` }))
              let next = latestModel.current
              for (const slot of ['header', 'footer'] as const) {
                const props = next.globalComponents[slot].props
                next = setAtPointer(next, `/globalComponents/${slot}/props`, { ...props, logoImageUrl: url, ...(Array.isArray(props.removedElements) ? { removedElements: props.removedElements.filter(path => path !== '/logoImageUrl') } : {}) })
              }
              commit(next)
            }} />} headerProps={model.globalComponents.header.props} onHeaderChange={(props) => commit(setAtPointer(model, '/globalComponents/header/props', props))} tokens={model.tokens} onChange={(tokens) => commit({ ...model, tokens })} />
          )}
        </aside>
      </div>
    </div>
  )
}

function PanelToggle({ side, label, open, onClick }: { side: 'left' | 'right'; label: string; open: boolean; onClick: () => void }) {
  return <button type="button" aria-controls={`editor-${side}-panel`} aria-expanded={open} title={`${open ? 'Collapse' : 'Expand'} ${label.toLowerCase()}`} onClick={onClick} className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${open ? 'border-sky-200 bg-sky-50 text-sky-800' : 'border-neutral-200 text-neutral-600 hover:bg-neutral-100'}`}>
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="4" width="18" height="16" rx="2" /><path d={side === 'left' ? 'M9 4v16' : 'M15 4v16'} /><path strokeWidth="3" opacity={open ? '.3' : '0'} d={side === 'left' ? 'M6 7v10' : 'M18 7v10'} /></svg>
    {label}
  </button>
}

function ThemePanel({ tokens, onChange, headerProps, onHeaderChange, logoUpload }: { headerProps: Record<string, unknown>; onHeaderChange: (props: Record<string, unknown>) => void; tokens: DesignTokens; onChange: (tokens: DesignTokens) => void; logoUpload: React.ReactNode }) {
  const buttons = tokens.buttons ?? { background: tokens.palette.primary, text: tokens.palette.primaryForeground, outline: tokens.palette.primary }
  return (
    <div className="grid gap-4 overflow-y-auto p-4">
      {logoUpload}
      <HeaderThemeControls props={headerProps} tokens={tokens} onChange={onHeaderChange} />
      <fieldset className="grid gap-3 rounded-lg border border-neutral-200 p-3">
        <legend className="px-1 text-sm font-semibold">Buttons</legend>
        <p className="text-xs text-neutral-500">Applies to buttons across every page, including enquiry forms.</p>
        {(['background', 'text', 'outline'] as const).map((key) => <div key={key} className="grid gap-2 text-xs"><span>{key === 'background' ? 'Background colour' : key === 'text' ? 'Text colour' : 'Outline button colour'}</span><ColorInput label={`Button ${key}`} value={buttons[key]} onChange={(value) => onChange({ ...tokens, buttons: { ...buttons, [key]: value } })} /></div>)}
        <button type="button" className="text-left text-xs text-sky-700 underline" onClick={() => { const next = { ...tokens }; delete next.buttons; onChange(next) }}>Reset buttons to theme defaults</button>
      </fieldset>
      <div>
        <p className="text-xs uppercase tracking-widest text-neutral-500">Palette</p>
        <div className="mt-2 grid gap-2">
          {(Object.keys(tokens.palette) as Array<keyof DesignTokens['palette']>).map((key) => (
            <div key={key} className="grid gap-2 text-xs">
              <span className="text-neutral-600">{key}</span>
              <ColorInput label={key} value={tokens.palette[key]} onChange={(value) => onChange({ ...tokens, palette: { ...tokens.palette, [key]: value } })} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs uppercase tracking-widest text-neutral-500">Typography</p>
        <Text
          label="Heading font stack"
          value={tokens.typography.headingFamily}
          onChange={(value) => onChange({ ...tokens, typography: { ...tokens.typography, headingFamily: value } })}
        />
        <Text
          label="Body font stack"
          value={tokens.typography.bodyFamily}
          onChange={(value) => onChange({ ...tokens, typography: { ...tokens.typography, bodyFamily: value } })}
        />
        <label className="mt-2 grid gap-1">
          <span className="text-xs font-medium text-neutral-700">Base size ({tokens.typography.baseSize}px)</span>
          <input
            type="range"
            min={14}
            max={20}
            value={tokens.typography.baseSize}
            onChange={(event) =>
              onChange({ ...tokens, typography: { ...tokens.typography, baseSize: Number(event.target.value) } })
            }
          />
        </label>
      </div>

      <div>
        <p className="text-xs uppercase tracking-widest text-neutral-500">Shape and rhythm</p>
        <label className="mt-2 grid gap-1">
          <span className="text-xs font-medium text-neutral-700">Corners</span>
          <select
            className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
            value={tokens.radius}
            onChange={(event) => onChange({ ...tokens, radius: event.target.value as DesignTokens['radius'] })}
          >
            {['none', 'sm', 'md', 'lg', 'full'].map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-2 grid gap-1">
          <span className="text-xs font-medium text-neutral-700">Section spacing</span>
          <select
            className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
            value={tokens.spacing}
            onChange={(event) => onChange({ ...tokens, spacing: event.target.value as DesignTokens['spacing'] })}
          >
            {['tight', 'normal', 'roomy'].map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-2 grid gap-1">
          <span className="text-xs font-medium text-neutral-700">Content width ({tokens.maxWidth}px)</span>
          <input
            type="range"
            min={960}
            max={1600}
            step={20}
            value={tokens.maxWidth}
            onChange={(event) => onChange({ ...tokens, maxWidth: Number(event.target.value) })}
          />
        </label>
      </div>
    </div>
  )
}

function Text({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="mt-2 grid gap-1">
      <span className="text-xs font-medium text-neutral-700">{label}</span>
      <input
        className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

const ghostButton = 'rounded-md border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-40'
const primaryButton = 'rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-40'
