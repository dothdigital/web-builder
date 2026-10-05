'use client'
import { ErrorNotice } from '@/components/error-notice'

import { MarqueeSelection } from './marquee-selection'
import { MultiObjectToolbar } from './multi-object-toolbar'
import type { ElementGroup, MultiAction } from '@/lib/multi-object-editing'
import { ObjectToolbar } from './object-toolbar'
import { imagePlacementAction } from '@/lib/image-placement'
import { objectScope, type ObjectAction } from '@/lib/object-editing'
import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { getComponent, tokensToCssVars } from '@awb/component-registry'
import type { RenderContext } from '@awb/component-registry'
import type { WebsiteModel, WebsitePage, WebsiteSection } from '@awb/website-model'
import { ImageResizeHandle } from './image-resize-handle'
import { outlinePath } from '@/lib/selection-outline'
import { useInlineTextEditing } from './inline-edit'

export type Viewport = 'desktop' | 'tablet' | 'mobile'

/// Canvas selection: a page section, or one of the two global components.
export type Selection = { kind: 'section'; id: string; element?: string; elements?: string[] } | { kind: 'header'; element?: string } | { kind: 'footer'; element?: string }

const viewportWidth: Record<Viewport, number> = { desktop: 1440, tablet: 834, mobile: 414 }

function SectionFrame({
  section,
  objectControls,
  context,
  selected,
  selectedElement,
  selectedElements,
  selectionMode,
  onMultiAction,
  onSelect,
  onMove,
  onDuplicate,
  onDelete,
  onToggleHidden,
  onEditText,
  onResizeImage,
  onResizeText,
  onDragStart,
  onDropBefore,
  onDropAfter,
  onInsertAfter,
}: {
  section: WebsiteSection
  objectControls: { projectId: string; imageUrls: Record<string, string>; sections: Array<{id: string; label: string}>; onAction: (action: ObjectAction) => void }
  context: RenderContext
  selected: boolean
  selectedElement?: string
  selectionMode: boolean
  selectedElements?: string[]
  onMultiAction: (action: MultiAction) => void
  onSelect: (element?: string, additive?: boolean) => void
  onMove: (direction: -1 | 1) => void
  onDuplicate: () => void
  onDelete: () => void
  onToggleHidden: () => void
  onEditText: (pointer: string, value: string) => void
  onResizeText: (path: string, style: { fontSize?: number; width?: number; height?: number; widthBasis?: 'section' }) => void
  onResizeImage: (path: string, size: { width: number; height: number }) => void
  onDragStart: () => void
  onDropBefore: () => void
  onDropAfter: () => void
  onInsertAfter: () => void
}) {
  const [node, setNode] = useState<HTMLDivElement | null>(null)
  const [dropEdge, setDropEdge] = useState<'top' | 'bottom'>()
  const definition = getComponent(section.componentId)

  useInlineTextEditing(node, selected && !section.hidden && !(selectedElements && selectedElements.length > 1), section.props, onEditText)
  useEffect(() => {
    if (!node || !selected || !selectedElement || (selectedElements && selectedElements.length > 1)) return
    const rendered = Array.from(node.querySelectorAll<HTMLElement>('[data-awb-element]'))
    const path = outlinePath(section.componentId, selectedElement, rendered.map(element => element.dataset.awbElement!))
    const elements = rendered.filter(element => element.dataset.awbElement === path)
    const previous = elements.map((element) => ({ element, outline: element.style.outline, offset: element.style.outlineOffset }))
    for (const element of elements) { element.style.outline = '2px solid #0284c7'; element.style.outlineOffset = '3px' }
    return () => { for (const entry of previous) { entry.element.style.outline = entry.outline; entry.element.style.outlineOffset = entry.offset } }
  }, [node, selected, selectedElement, selectedElements, section.props, section.componentId])


  if (!definition) {
    return (
      <div className="border border-dashed border-red-300 p-6 text-sm text-red-700">
        Unknown component <code>{section.componentId}</code> — it is not in the registry and will never be rendered.
      </div>
    )
  }

  const parsed = definition.propsSchema.safeParse(section.props)
  const Component = definition.render

  return (
    <div
      data-awb-section-id={section.hidden ? undefined : section.id}
      data-awb-editor-canvas="true"
      data-awb-selected-frame={selected ? "true" : undefined}
      role="presentation"
      onPointerDownCapture={(event) => {
        const target = event.target as HTMLElement
        if (event.button !== 0 || event.shiftKey || selectionMode || target.isContentEditable || target.closest('input,textarea,select,[contenteditable="true"],[contenteditable="plaintext-only"]') || !node?.contains(target)) return
        const path = target.closest<HTMLElement>('[data-awb-element]')?.dataset.awbElement
        const scope = path ? objectScope(section.props, path) : undefined
        const next = scope?.root ? `/freeElements/${scope.index}` : path
        // Install interaction handlers before this same pointerdown reaches the object.
        if (next && (!selected || next !== selectedElement)) flushSync(() => onSelect(next))
      }}
      onClickCapture={(event) => {
        const target = event.target as HTMLElement
        if (target.isContentEditable || node?.closest<HTMLElement>('[data-awb-canvas-scroll]')?.dataset.awbMarqueeHandled === 'true') return
        if (node?.contains(target)) { const path = target.closest<HTMLElement>('[data-awb-element]')?.dataset.awbElement; const scope = path ? objectScope(section.props, path) : undefined; const next = scope?.root ? `/freeElements/${scope.index}` : path; if (event.shiftKey || !selected || next !== selectedElement) onSelect(next, event.shiftKey) }
      }}
      onClick={(event) => {
        event.stopPropagation()
        if (!node?.contains(event.target as HTMLElement)) onSelect()
      }}
      onDragOver={(event) => {
        event.preventDefault()
        const bounds = event.currentTarget.getBoundingClientRect()
        setDropEdge(event.clientY - bounds.top < bounds.height / 2 ? 'top' : 'bottom')
      }}
      onDragLeave={() => setDropEdge(undefined)}
      onDrop={(event) => {
        event.preventDefault()
        const edge = dropEdge
        setDropEdge(undefined)

        if (edge === 'top') {
          onDropBefore()
        } else {
          onDropAfter()
        }
      }}
      className={`group relative outline-offset-[-2px] ${
        selected && !selectedElement ? 'outline outline-2 outline-sky-500' : selectedElement && selected ? '' : 'hover:outline hover:outline-1 hover:outline-sky-300'
      }`}
    >
      {dropEdge && (
        <div
          className={`pointer-events-none absolute inset-x-0 z-20 h-1 bg-sky-500 ${dropEdge === 'top' ? 'top-0' : 'bottom-0'}`}
        />
      )}

      <div
        className={`absolute left-2 top-2 z-10 flex items-center gap-1 rounded-md bg-sky-600 px-1.5 py-1 text-[11px] text-white shadow ${
          selected && selectedElement ? 'hidden' : selected ? 'flex' : 'hidden group-hover:flex'
        }`}
      >
        <span
          draggable
          onDragStart={(event) => {
            event.stopPropagation()
            event.dataTransfer.effectAllowed = 'move'
            event.dataTransfer.setData('text/plain', section.id)
            onDragStart()
          }}
          title="Drag to reorder"
          className="cursor-grab px-1 active:cursor-grabbing"
        >
          ⠿
        </span>
        <span className="px-1">{definition.name}</span>
        <ToolbarButton label="Move up" onClick={() => onMove(-1)}>
          ↑
        </ToolbarButton>
        <ToolbarButton label="Move down" onClick={() => onMove(1)}>
          ↓
        </ToolbarButton>
        <ToolbarButton label="Duplicate" onClick={onDuplicate}>
          ⧉
        </ToolbarButton>
        <ToolbarButton label={section.hidden ? 'Show section' : 'Hide section'} onClick={onToggleHidden}>
          {section.hidden ? '◎' : '◍'}
        </ToolbarButton>
        <ToolbarButton label="Delete" onClick={onDelete}>
          ✕
        </ToolbarButton>
      </div>

      {section.hidden && (
        <div className="absolute right-2 top-2 z-10 rounded bg-neutral-900/80 px-2 py-0.5 text-[11px] text-white">
          Hidden
        </div>
      )}

      <div style={{ cursor: selectionMode ? 'crosshair' : undefined }} data-awb-section-content="true" ref={setNode} className={section.hidden ? 'opacity-40' : undefined}>
        {parsed.success ? (
          <Component props={parsed.data} context={context} />
        ) : (
          <div className="border border-dashed border-amber-300 p-6 text-sm text-amber-800">
            <ErrorNotice code="WT-EDITOR-001" message={"This section has invalid content and could not be displayed: " + parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')} />
          </div>
        )}
      </div>

      {selected && !section.hidden && selectedElements && selectedElements.length > 1 && <MultiObjectToolbar node={node} paths={selectedElements} props={section.props} onAction={onMultiAction} onClear={() => onSelect()} />}
      {selected && !section.hidden && !(selectedElements && selectedElements.length > 1) && selectedElement && <ObjectToolbar key={`toolbar-${selectedElement}`} node={node} path={selectedElement} props={section.props} sectionId={section.id} {...objectControls} onSelect={onSelect} />}
      {selected && !section.hidden && !(selectedElements && selectedElements.length > 1) && selectedElement && <ImageResizeHandle sectionWideImages revision={section.props} key={selectedElement} node={node} path={selectedElement} onResize={(size) => {
        const element = node && Array.from(node.querySelectorAll<HTMLElement>('[data-awb-element]')).find((entry) => entry.dataset.awbElement === selectedElement)
        if (element && node) objectControls.onAction(imagePlacementAction(element, node, section.id, size))
        else onResizeImage(selectedElement, size)
      }} onFontResize={(fontSize) => onResizeText(selectedElement, fontSize)} />}
      <button
        type="button"
        title="Add a section here"
        onClick={(event) => {
          event.stopPropagation()
          onInsertAfter()
        }}
        className="absolute inset-x-0 -bottom-3 z-10 mx-auto hidden h-6 w-6 items-center justify-center rounded-full bg-sky-600 text-sm text-white shadow group-hover:flex"
      >
        +
      </button>
    </div>
  )
}

function GlobalFrame({
  objectControls,
  slot,
  componentId,
  props,
  context,
  selected,
  onSelect,
  selectedElement,
  onEditText,
}: {
  objectControls: { projectId: string; imageUrls: Record<string, string>; sections: Array<{id: string; label: string}>; onAction: (action: ObjectAction) => void }
  slot: 'header' | 'footer'
  componentId: string
  props: Record<string, unknown>
  context: RenderContext
  selected: boolean
  selectedElement?: string
  onSelect: (element?: string) => void
  onEditText: (pointer: string, value: string) => void
}) {
  const [node, setNode] = useState<HTMLDivElement | null>(null)
  const definition = getComponent(componentId)

  useInlineTextEditing(node, selected, props, onEditText)
  useEffect(() => {
    if (!node || !selected || !selectedElement) return
    const targets = Array.from(node.querySelectorAll<HTMLElement>('[data-awb-element]')).filter((entry) => entry.dataset.awbElement === selectedElement)
    const previous = targets.map((target) => target.style.outline)
    targets.forEach((target) => { target.style.outline = '2px solid #0284c7' })
    return () => targets.forEach((target, index) => { target.style.outline = previous[index]! })
  }, [node, selected, selectedElement])

  if (!definition) {
    return null
  }

  const parsed = definition.propsSchema.safeParse(props)

  if (!parsed.success) {
    return null
  }

  const Component = definition.render

  return (
    <div
      style={slot === 'header' ? { position: 'relative', zIndex: 50 } : undefined}
      data-awb-editor-canvas="true"
      data-awb-selected-frame={selected ? "true" : undefined}
      role="presentation"
      onClickCapture={(event) => {
        const target = event.target as HTMLElement
        if (target.isContentEditable) return
        if (!node?.contains(target)) return
        if (target.closest('a,button[type="submit"]')) event.preventDefault()
        const menu = target.closest<HTMLElement>('[data-awb-menu]')
        onSelect(menu?.dataset.awbElement ?? target.closest<HTMLElement>('[data-awb-element]')?.dataset.awbElement)
      }}
      onClick={(event) => {
        event.stopPropagation()
        if (!node?.contains(event.target as Node)) onSelect()
      }}
      className={`group relative outline-offset-[-2px] ${
        selected ? 'outline outline-2 outline-violet-500' : 'hover:outline hover:outline-1 hover:outline-violet-300'
      }`}
    >
      <div
        className={`absolute left-2 top-2 z-10 rounded-md bg-violet-600 px-2 py-1 text-[11px] capitalize text-white shadow ${
          selected ? 'block' : 'hidden group-hover:block'
        }`}
      >
        Global {slot}
      </div>
      <div ref={setNode}>
        <Component props={parsed.data} context={context} />
      </div>
      {selected && <ObjectToolbar key={selectedElement ?? 'global-section'} node={node} path={selectedElement ?? '/layout/0'} props={props} {...objectControls} onSelect={onSelect} />}
    </div>
  )
}

function ToolbarButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className="rounded px-1.5 py-0.5 hover:bg-sky-500"
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
    >
      {children}
    </button>
  )
}

export function EditorCanvas({
  projectId, imageUrls, onObjectAction,
  model,
  selectionMode,
  onAreaSelect,
  onMultiAction,
  page,
  viewport,
  selection,
  onSelect,
  onMoveSection,
  onDuplicateSection,
  onDeleteSection,
  onToggleHidden,
  onEditText,
  onResizeImage,
  onResizeText,
  onReorder,
  onInsertAfter,
}: {
  selectionMode: boolean
  onAreaSelect: (id: string, paths: string[]) => void
  projectId: string
  imageUrls: Record<string, string>
  onMultiAction: (sectionId: string, action: MultiAction) => void
  onObjectAction: (target: Selection, path: string, action: ObjectAction) => void
  model: WebsiteModel
  page: WebsitePage
  viewport: Viewport
  selection?: Selection
  onSelect: (selection?: Selection) => void
  onMoveSection: (sectionId: string, direction: -1 | 1) => void
  onDuplicateSection: (sectionId: string) => void
  onDeleteSection: (sectionId: string) => void
  onToggleHidden: (sectionId: string) => void
  onEditText: (target: Selection, pointer: string, value: string) => void
  onResizeText: (sectionId: string, path: string, style: { fontSize?: number; width?: number; height?: number; widthBasis?: 'section' }) => void
  onResizeImage: (sectionId: string, path: string, size: { width: number; height: number }) => void
  onReorder: (sourceId: string, targetIndex: number) => void
  onInsertAfter: (sectionId: string) => void
}) {
  const [canvasNode, setCanvasNode] = useState<HTMLDivElement | null>(null)
  const [draggingId, setDraggingId] = useState<string>()
  const context: RenderContext = { tokens: model.tokens, baseUrl: '', editing: true }
  const header = getComponent(model.globalComponents.header.componentId)
  const footer = getComponent(model.globalComponents.footer.componentId)
  const headerProps = header?.propsSchema.safeParse(model.globalComponents.header.props)
  const footerProps = footer?.propsSchema.safeParse(model.globalComponents.footer.props)

  const move = (targetIndex: number) => {
    if (draggingId) {
      onReorder(draggingId, targetIndex)
      setDraggingId(undefined)
    }
  }

  return (
    <div
      style={{ overflowAnchor: 'none' }}
      ref={setCanvasNode}
      data-awb-canvas-scroll="true"
      className="flex h-full justify-center overflow-auto bg-neutral-200 p-6"
      onClick={() => { if (canvasNode?.dataset.awbMarqueeHandled !== 'true') onSelect(undefined) }}
      /// Links and forms inside the canvas are content, not navigation.
      onClickCapture={(event) => {
        if ((event.target as HTMLElement).closest('a')) {
          event.preventDefault()
        }
      }}
      onSubmitCapture={(event) => event.preventDefault()}
    >
      <MarqueeSelection node={canvasNode} enabled={selectionMode} paths={selection?.kind === 'section' ? selection.elements ?? (selection.element ? [selection.element] : []) : []} sectionId={selection?.kind === 'section' ? selection.id : undefined} onSelect={onAreaSelect} />
      <div
        className="h-fit w-full origin-top bg-white shadow-xl transition-all"
        style={{ maxWidth: viewportWidth[viewport], ...tokensToCssVars(model.tokens) }}
      >
        {header && headerProps?.success && (
          <GlobalFrame
            objectControls={{ projectId, imageUrls, sections: [], onAction: (action) => onObjectAction({kind: "header"}, selection?.element ?? '/layout/0', action) }}
            slot="header"
            componentId={model.globalComponents.header.componentId}
            props={model.globalComponents.header.props}
            context={context}
            selected={selection?.kind === 'header'}
            selectedElement={selection?.kind === 'header' ? selection.element : undefined}
            onSelect={(element) => onSelect({ kind: 'header', element })}
            onEditText={(pointer, value) => onEditText({ kind: 'header' }, pointer, value)}
          />
        )}
        {page.sections.map((section, index) => (
          <SectionFrame
            key={section.id}
            objectControls={{ projectId, imageUrls, sections: page.sections.filter((entry) => !entry.hidden).map((entry, i) => ({ id: entry.id, label: `${i + 1}. ${getComponent(entry.componentId)?.name ?? entry.componentId}` })), onAction: (action) => { if (selection?.element) onObjectAction({kind: "section", id: section.id}, selection.element, action) } }}
            section={section}
            context={context}
            selected={selection?.kind === 'section' && selection.id === section.id}
            selectedElement={selection?.kind === 'section' && selection.id === section.id ? selection.element : undefined}
            selectionMode={selectionMode}
            selectedElements={selection?.kind === 'section' && selection.id === section.id ? selection.elements : undefined}
            onMultiAction={(action) => onMultiAction(section.id, action)}
            onSelect={(element, additive) => {
              const current = selection?.kind === 'section' && selection.id === section.id ? selection.elements ?? (selection.element ? [selection.element] : []) : []
              const frame = Array.from(document.querySelectorAll<HTMLElement>('[data-awb-section-id]')).find((entry) => entry.dataset.awbSectionId === section.id)
              const nodes = Array.from(frame?.querySelectorAll<HTMLElement>('[data-awb-element]') ?? [])
              const clicked = nodes.find((entry) => entry.dataset.awbElement === element)
              const group = element ? ((section.props.elementGroups ?? []) as ElementGroup[]).find((entry) => entry.paths.some((path) => path === element || (clicked && nodes.find((node) => node.dataset.awbElement === path)?.contains(clicked)))) : undefined
              let paths = element ? additive ? current.includes(element) ? current.filter((path) => path !== element) : [...current, element] : current.length > 1 && current.includes(element) ? current : group?.paths ?? [element] : []
              // Never select both an ancestor and its descendant for a batch move.
              paths = paths.filter((path) => { const child = nodes.find((entry) => entry.dataset.awbElement === path); return child && !paths.some((other) => other !== path && nodes.find((entry) => entry.dataset.awbElement === other)?.contains(child)) })
              onSelect({ kind: 'section', id: section.id, element: paths[paths.length - 1], elements: paths })
            }}
            onMove={(direction) => onMoveSection(section.id, direction)}
            onDuplicate={() => onDuplicateSection(section.id)}
            onDelete={() => onDeleteSection(section.id)}
            onToggleHidden={() => onToggleHidden(section.id)}
            onEditText={(pointer, value) => onEditText({ kind: 'section', id: section.id }, pointer, value)}
            onResizeText={(path, fontSize) => onResizeText(section.id, path, fontSize)}
            onResizeImage={(path, size) => onResizeImage(section.id, path, size)}
            onDragStart={() => setDraggingId(section.id)}
            onDropBefore={() => move(index)}
            onDropAfter={() => move(index + 1)}
            onInsertAfter={() => onInsertAfter(section.id)}
          />
        ))}
        {footer && footerProps?.success && (
          <GlobalFrame
            objectControls={{ projectId, imageUrls, sections: [], onAction: (action) => onObjectAction({kind: "footer"}, selection?.element ?? '/layout/0', action) }}
            slot="footer"
            componentId={model.globalComponents.footer.componentId}
            props={model.globalComponents.footer.props}
            context={context}
            selected={selection?.kind === 'footer'}
            selectedElement={selection?.kind === 'footer' ? selection.element : undefined}
            onSelect={(element) => onSelect({ kind: 'footer', element })}
            onEditText={(pointer, value) => onEditText({ kind: 'footer' }, pointer, value)}
          />
        )}
      </div>
    </div>
  )
}
