'use client'
import { ErrorNotice } from '@/components/error-notice'

import { SpacingProperties } from './spacing-properties'
import { ContactFieldsEditor } from './contact-fields-editor'
import { updateContactFormFields } from '@/lib/contact-form-fields'
import { renderedBackgroundColor } from '@/lib/rendered-background'
import { ListTextEditor } from './list-text-editor'
import { objectScope } from '@/lib/object-editing'
import { ColorInput } from './color-input'
import { ElementColorsPanel } from './element-colors-panel'
import { ImageSizeControls } from './image-size-controls'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { getComponent, colorTargets, normalizeHeroSettings, type EditorField } from '@awb/component-registry'
import { listItemTemplate } from '@/lib/list-item-template'
import { reorderElementColors } from '@/lib/element-color-order'
import { setAtPointer } from '@/lib/json-pointer'
import { getAtPointer } from '@/lib/json-pointer'

export interface InspectorProps {
  renderedPathPrefix?: string
  onDeleteSection?: () => void
  selectedElement?: string
  onSelectElement?: (path?: string) => void
  imageUrls?: Record<string, string>
  projectId: string
  componentName: string
  fields: EditorField[]
  props: Record<string, unknown>
  onChange: (pointer: string, value: unknown) => void
  onAskAi?: (instruction: string) => Promise<void>
  variants: Array<{ componentId: string; name: string; description: string }>
  currentComponentId: string
  onSwitchVariant: (componentId: string) => void
  hidden?: boolean
  onToggleHidden?: () => void
  kind?: string
}

export function Inspector(input: InspectorProps) {
  const scope = input.selectedElement ? objectScope(input.props, input.selectedElement) : undefined
  if (scope?.entry) {
    const definition = getComponent(scope.entry.componentId)
    return <InspectorFields {...input} componentName={`Moved object · ${definition?.name ?? input.componentName}`} currentComponentId={scope.entry.componentId} fields={definition?.editorFields ?? input.fields} props={scope.props} renderedPathPrefix={scope.prefix} selectedElement={scope.path} onSelectElement={(path) => input.onSelectElement?.(path ? `${scope.prefix}${path}` : undefined)} onChange={(pointer, value) => {
      if (pointer === '/removedElements' && Array.isArray(value) && value.includes(scope.path)) input.onChange('/removedElements', [...new Set([...(input.props.removedElements as string[] ?? []), scope.root ? `/freeElements/${scope.index}` : input.selectedElement!])])
      else input.onChange(`${scope.prefix}${pointer}`, value)
    }} />
  }
  return <InspectorFields {...input} />
}

function InspectorFields({
  renderedPathPrefix,
  projectId,
  onDeleteSection,
  componentName,
  selectedElement: inputSelectedElement,
  onSelectElement,
  imageUrls = {},
  fields,
  props,
  onChange,
  onAskAi,
  variants,
  currentComponentId,
  onSwitchVariant,
  hidden,
  onToggleHidden,
  kind = 'Section',
}: InspectorProps) {
  const parsedProps = getComponent(currentComponentId)?.propsSchema.safeParse(props)
  const effectiveProps = parsedProps?.success ? parsedProps.data as Record<string, unknown> : props
  const isHero = getComponent(currentComponentId)?.family === 'HERO'
  const isHeader = getComponent(currentComponentId)?.family === 'HEADER'
  const displayedProps = isHero ? normalizeHeroSettings(effectiveProps) : isHeader && effectiveProps.customBackground && effectiveProps.sectionBackgroundMode === 'original' ? { ...effectiveProps, sectionBackgroundMode: 'colour', sectionBackgroundColor: effectiveProps.backgroundColor } : effectiveProps
  const [sectionColour, setSectionColour] = useState<string>()
  useEffect(() => {
    const frame = document.querySelector<HTMLElement>('[data-awb-selected-frame="true"]')
    const root = frame && (Array.from(frame.querySelectorAll<HTMLElement>('[data-awb-element]')).find(element => element.dataset.awbElement === '/layout/0') ?? frame.querySelector<HTMLElement>('header,section,footer'))
    if (!root) return
    const measure = () => setSectionColour(renderedBackgroundColor(root))
    const raf = requestAnimationFrame(measure)
    const observer = new MutationObserver(measure)
    let current: HTMLElement | null = root
    while (current) { observer.observe(current, { attributes: true, attributeFilter: ['style', 'class'] }); current = current.parentElement }
    return () => { cancelAnimationFrame(raf); observer.disconnect() }
  }, [props, currentComponentId])
  let selectedElement = inputSelectedElement
  if (currentComponentId === 'ManualSection' && selectedElement) {
    const root = selectedElement.match(/^\/items\/\d+/)?.[0]
    const item = root ? getAtPointer(displayedProps, root) as { kind?: string } | undefined : undefined
    if (item?.kind === 'form') selectedElement = root
  }
  const selectedValue = selectedElement ? getAtPointer(displayedProps, selectedElement) : undefined
  const contactFieldIndex = currentComponentId === 'ContactSplit' ? selectedElement?.match(/^\/formFields\/(\d+)\/input$/)?.[1] : undefined
  const contactFields = (displayedProps.formFields ?? []) as Array<{ type: string; rows?: number }>
  const selectedContactField = contactFieldIndex === undefined ? undefined : contactFields[Number(contactFieldIndex)]
  const selectedFields: EditorField[] = selectedElement ? (selectedValue && typeof selectedValue === 'object' && !Array.isArray(selectedValue)
    ? Object.keys(selectedValue).filter((key) => !['id', 'source', 'kind'].includes(key)).map((key) => ({ path: `${selectedElement}/${key}`, label: key, type: key.toLowerCase().includes('imageurl') ? 'image' : ['body', 'description', 'quote', 'answer'].includes(key) ? 'textarea' : Array.isArray((selectedValue as Record<string, unknown>)[key]) ? 'list' : 'text' }))
    : selectedValue !== undefined || selectedElement.endsWith('/number') ? [{ path: selectedElement, label: selectedElement.split('/').pop() || 'Content', type: (selectedElement.toLowerCase().endsWith('imageurl') || /^\/images\/\d+\/url$/.test(selectedElement)) ? 'image' : Array.isArray(selectedValue) ? 'list' : 'textarea' }] : []) : fields
  if (currentComponentId === 'ManualSection' && selectedValue && typeof selectedValue === 'object' && 'kind' in selectedValue) {
    const keys = manualKeys(String(selectedValue.kind))
    selectedFields.splice(0, selectedFields.length, ...selectedFields.filter(field => keys.includes(field.path.split('/').pop()!)))
    if (selectedValue.kind === 'form') for (const key of keys) if (!selectedFields.some(field => field.path.endsWith('/' + key))) selectedFields.push({ path: `${selectedElement}/${key}`, label: key === 'submitLabel' ? 'Submit button text' : key === 'submissionUrl' ? 'Custom submission URL (optional)' : 'Form fields', type: key === 'formFields' ? 'list' : 'text' })
  }
  const removalPath = selectedElement?.replace(/^(\/extraElements\/\d+)\/[^/]+$/, '$1').replace(/^(\/(?:cta|primaryCta|secondaryCta))\/(?:label|href)$/, '$1')
  const removed = (displayedProps.removedElements ?? []) as string[]
  const removable = removalPath && (removalPath.startsWith('/layout/') || colorTargets(currentComponentId, displayedProps).some((entry) => entry.path === removalPath) || /(?:imageUrl|logoImageUrl|\/images\/\d+\/url)$/.test(removalPath))
  const [instruction, setInstruction] = useState('')
  const [askingAi, setAskingAi] = useState(false)
  const [aiError, setAiError] = useState<string>()

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="border-b border-neutral-200 p-4">
        <p className="text-xs uppercase tracking-widest text-neutral-500">{kind}</p>
        <h2 className="text-sm font-semibold">{componentName}</h2>
        {isHeader && <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(displayedProps.sticky)} onChange={event => onChange('/sticky', event.target.checked)} />Sticky header</label>}
        {selectedElement && <div className="mt-2 text-xs"><p>Editing: {colorTargets(currentComponentId, displayedProps).find((target) => target.path === selectedElement)?.label ?? selectedElement.split('/').slice(1).join(' → ')}</p><button type="button" className="mt-1 text-sky-700 underline" onClick={() => onSelectElement?.(undefined)}>Back to section properties</button></div>}
        {currentComponentId.startsWith('Header') && (selectedElement === '/logoImageUrl' || selectedElement === '/logoText') && <label className="mt-3 grid gap-1 text-xs">Logo position in header<select aria-label="Logo position in header" className="rounded border p-2" value={String(displayedProps.logoAlignment ?? 'original')} onChange={(event) => onChange('/logoAlignment', event.target.value)}><option value="original">Original template position</option><option value="left">Left</option><option value="center">Centre</option><option value="right">Right</option></select></label>}
        {removable && <button type="button" className="mt-3 block rounded border border-red-300 px-3 py-2 text-xs text-red-700" onClick={() => onChange('/removedElements', removed.includes(removalPath) ? removed.filter((path) => path !== removalPath) : [...removed, removalPath])}>{removed.includes(removalPath) ? 'Restore this element' : 'Remove this element'}</button>}
        {!selectedElement && onDeleteSection && <button type="button" className="mt-3 block rounded border border-red-300 px-3 py-2 text-xs text-red-700" onClick={onDeleteSection}>Delete section</button>}
        {onToggleHidden && (
          <label className="mt-3 flex items-center gap-2 text-xs text-neutral-600">
            <input type="checkbox" checked={hidden ?? false} onChange={onToggleHidden} />
            Hide this section
          </label>
        )}
      </div>

      {!renderedPathPrefix && <div className="grid gap-2 border-b border-neutral-200 bg-sky-50/50 p-4">
        <h3 className="text-sm font-semibold">{isHeader ? 'Header' : 'Section'} background</h3>
        <p className="text-xs text-neutral-500">{isHero && displayedProps.imageLayout === 'background' ? 'Changes the colour behind and over the hero image.' : `Changes the whole ${isHeader ? 'header' : 'section'}, even while a layout box or text is selected.`}</p>
        <ColorInput label={isHero && displayedProps.imageLayout === 'background' ? 'Hero background / overlay colour' : `${isHeader ? 'Header' : 'Section'} background colour`} value={String(isHero && displayedProps.imageLayout === 'background' ? displayedProps.overlayColor ?? sectionColour ?? '#102a43' : displayedProps.sectionBackgroundMode !== 'original' ? displayedProps.sectionBackgroundColor ?? sectionColour ?? '#ffffff' : sectionColour ?? '#ffffff')} onChange={(color) => {
          if (isHero && displayedProps.imageLayout === 'background') onChange('/overlayColor', color)
          else onChange('', { ...displayedProps, sectionBackgroundMode: 'colour', sectionBackgroundColor: color, ...(isHeader ? { customBackground: false } : {}) })
        }} />
        {displayedProps.sectionBackgroundMode === 'colour' && <button type="button" className="text-left text-xs text-sky-700 underline" onClick={() => onChange('', { ...displayedProps, sectionBackgroundMode: 'original', ...(isHeader ? { customBackground: false } : {}) })}>Use original background</button>}
      </div>}

      {!selectedElement && variants.length > 1 && (
        <div className="border-b border-neutral-200 p-4">
          <p className="text-xs font-medium text-neutral-700">Layout variant</p>
          <select
            className="mt-2 w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
            value={currentComponentId}
            onChange={(event) => onSwitchVariant(event.target.value)}
          >
            {variants.map((variant) => (
              <option key={variant.componentId} value={variant.componentId}>
                {variant.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-neutral-500">
            {variants.find((variant) => variant.componentId === currentComponentId)?.description}
          </p>
        </div>
      )}

      {currentComponentId === 'ContactSplit' && <div className="m-4"><ContactFieldsEditor value={displayedProps.formFields} onChange={value => onChange('', updateContactFormFields(displayedProps, value))} /><label className="mt-4 grid gap-1 text-xs">Custom submission URL (HTTPS)<input type="url" className="rounded border p-2" placeholder="https://your-provider.com/form-endpoint" value={String(displayedProps.submissionUrl ?? '')} onChange={event => onChange('/submissionUrl', event.target.value)} /></label><p className="mt-2 text-xs text-neutral-500">Leave blank to save leads in Webtummy. A custom URL sends standard form POST data directly to that provider instead. It must accept browser form submissions and handle validation and spam protection. Never enter a secret API key here.</p></div>}
      {selectedContactField?.type === 'textarea' && <label className="m-4 grid gap-2 text-xs">Textarea lines<input aria-label="Textarea lines" type="number" min={1} max={30} className="rounded border p-2" value={selectedContactField.rows ?? 5} onChange={event => { const rows = Number(event.target.value); if (Number.isInteger(rows) && rows >= 1 && rows <= 30) onChange('', updateContactFormFields(displayedProps, contactFields.map((field, index) => index === Number(contactFieldIndex) ? { ...field, rows } : field))) }} /><span className="text-neutral-500">Sets the visible rows and resets a manually resized height.</span></label>}
      {selectedElement && <SpacingProperties paths={[selectedElement]} props={displayedProps} prefix={renderedPathPrefix} onChange={(patch) => {
        const colors = (displayedProps.elementColors ?? {}) as Record<string, Record<string, unknown>>
        onChange('/elementColors', { ...colors, [selectedElement]: { ...colors[selectedElement], ...patch } })
      }} />}
      {colorTargets(currentComponentId, displayedProps).filter((target) => /^\/(cta|primaryCta|secondaryCta)$/.test(target.path) && (!selectedElement || !(selectedElement === target.path || selectedElement.startsWith(`${target.path}/`)))).map((target) => (
        <ElementColorsPanel renderedPathPrefix={renderedPathPrefix} key={`button-${target.path}`} buttonPanel componentId={currentComponentId} props={displayedProps} onChange={onChange} selectedPath={target.path} />
      ))}
      <ElementColorsPanel renderedPathPrefix={renderedPathPrefix} key={selectedElement ?? currentComponentId} componentId={currentComponentId} props={displayedProps} onChange={onChange} selectedPath={selectedElement} onSelect={onSelectElement} />
      <div className="grid gap-4 p-4">
        {selectedFields.filter((field) => !(currentComponentId === 'ContactSplit' && (field.path.startsWith('/formFields') || field.path === '/submissionUrl')) && (!isHero || !field.path.startsWith('/sectionBackground')) && (!isHeader || !['/customBackground', '/backgroundColor', '/sticky'].includes(field.path))).map((field) => (
          <FieldEditor
            key={field.path}
            field={isHeader ? { ...field, label: field.label.replace(/^Section/, 'Header') } : field}
            componentId={currentComponentId}
            sizeControls={field.type === 'image' ? <ImageSizeControls path={field.path} sizes={(displayedProps.imageSizes ?? {}) as Parameters<typeof ImageSizeControls>[0]['sizes']} background={field.path === '/sectionBackgroundImageUrl' || field.path === '/backgroundImageUrl' || (isHero && displayedProps.imageLayout === 'background' && field.path === '/imageUrl')} onChange={(sizes) => onChange('/imageSizes', sizes)} /> : undefined}
            imageUrls={imageUrls}
            projectId={projectId}
            value={getAtPointer(displayedProps, field.path)}
            onChange={(value) => {
              const previous = getAtPointer(displayedProps, field.path)
              if (Array.isArray(value) && Array.isArray(previous)) {
                const elementColors = reorderElementColors((displayedProps.elementColors ?? {}) as Record<string, unknown>, field.path, previous, value)
                onChange('', { ...setAtPointer(displayedProps, field.path, value), elementColors, imageSizes: reorderElementColors((displayedProps.imageSizes ?? {}) as Record<string, unknown>, field.path, previous, value) })
              } else onChange(field.path, value)
            }}
          />
        ))}
      </div>

      {onAskAi && !selectedElement && (
      <div className="mt-auto border-t border-neutral-200 p-4">
        <p className="text-xs font-medium text-neutral-700">Ask AI about this section</p>
        <textarea
          rows={2}
          className="mt-2 w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          placeholder="Make the heading shorter and more direct"
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
        />
        <button
          type="button"
          disabled={askingAi || instruction.trim().length === 0}
          className="mt-2 w-full rounded-md bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-40"
          onClick={async () => {
            setAskingAi(true)
            setAiError(undefined)

            try {
              await onAskAi(instruction.trim())
              setInstruction('')
            } catch (error) {
              setAiError(error instanceof Error ? error.message : 'The AI edit was rejected')
            } finally {
              setAskingAi(false)
            }
          }}
        >
          {askingAi ? 'Queuing…' : 'Generate edit in background'}
        </button>
        {aiError && <ErrorNotice code="WT-UPLOAD-001" message={aiError} className="mt-2 text-xs text-red-700" />}
      </div>
      )}
    </div>
  )
}

function FieldEditor({
  sizeControls,
  componentId,
  imageUrls,
  field,
  value,
  projectId,
  onChange,
}: {
  sizeControls?: ReactNode
  componentId: string
  imageUrls: Record<string, string>
  field: EditorField
  value: unknown
  projectId: string
  onChange: (value: unknown) => void
}) {
  if (componentId === 'ManualSection' && field.path.endsWith('/formFields')) return <ContactFieldsEditor value={value ?? [{ name: 'name', label: 'Name', type: 'text', required: true }, { name: 'email', label: 'Email', type: 'email', required: true }, { name: 'phone', label: 'Phone', type: 'tel' }, { name: 'message', label: 'Message', type: 'textarea', required: true }]} onChange={onChange} />
  if (componentId === 'ManualSection' && field.path.endsWith('/height')) field = { ...field, type: 'number' }
  if (componentId === 'ManualSection' && field.path.endsWith('/headingLevel')) field = { ...field, type: 'select', options: ['2', '3'] }
  const label = (
    <span className="flex items-center justify-between">
      <span className="text-xs font-medium text-neutral-700">{field.label}</span>
      {field.headingLevel && <span className="text-[10px] text-neutral-400">H{field.headingLevel}</span>}
    </span>
  )

  if (field.type === 'boolean') {
    return (
      <label className="flex items-center gap-2 text-xs text-neutral-700">
        <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
        {field.label}
      </label>
    )
  }

  if (field.type === 'image') {
    return (
      <div className="grid gap-1">
        {label}
        <ImageField imageUrls={imageUrls} projectId={projectId} value={typeof value === 'string' ? value : ''} onChange={onChange} />
        {sizeControls}
      </div>
    )
  }

  if (field.type === 'select') {
    const showcaseLabels: Record<string, string> = ['PortfolioShowcase', 'CredentialsShowcase'].includes(componentId) && ['/layout', '/imageFit'].includes(field.path) ? { featured: 'Featured project + grid', grid: 'Card grid', rail: 'Horizontal gallery', compact: 'Compact badge wall', cover: 'Fill image area (crop)', contain: 'Show complete image' } : {}
    return (
      <label className="grid gap-1">
        {label}
        <select
          className={controlClass}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
        >
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {showcaseLabels[option] ?? option}
            </option>
          ))}
        </select>
      </label>
    )
  }

  if (field.type === 'color') {
    return <div className="grid gap-1">{label}<ColorInput label={field.label} value={typeof value === 'string' ? value : '#102a43'} onChange={onChange} /></div>
  }

  if (field.type === 'range') {
    return <label className="grid gap-1">{label}<span className="text-xs text-neutral-500">{typeof value === 'number' ? value : field.min ?? 0}%</span><input type="range" min={field.min} max={field.max} step={field.step} value={typeof value === 'number' ? value : field.min ?? 0} onChange={(event) => onChange(Number(event.target.value))} /></label>
  }

  if (field.type === 'number') {
    return (
      <label className="grid gap-1">
        {label}
        <input
          type="number"
          className={controlClass}
          value={typeof value === 'number' ? value : ''}
          onChange={(event) => onChange(event.target.value === '' ? undefined : Number(event.target.value))}
        />
      </label>
    )
  }

  if (componentId === 'ManualSection' && field.path === '/items') return <ManualElementsEditor items={Array.isArray(value) ? value : []} imageUrls={imageUrls} projectId={projectId} onChange={onChange} />
  if (['PortfolioShowcase', 'CredentialsShowcase'].includes(componentId) && field.path === '/items') return <ShowcaseItemsEditor credentials={componentId === 'CredentialsShowcase'} items={Array.isArray(value) ? value : []} imageUrls={imageUrls} projectId={projectId} onChange={onChange} />

  if (field.type === 'list' || field.type === 'collection') {
    return <ListField componentId={componentId} template={listItemTemplate(componentId, field.path)} field={field} value={Array.isArray(value) ? value : []} onChange={onChange} />
  }

  if ((componentId === 'BlogArticle' && /^\/blocks\/\d+\/body$/.test(field.path) || componentId === 'ManualSection' && /^\/items\/\d+\/text$/.test(field.path))) return <ListTextEditor label={field.label} value={typeof value === 'string' ? value : ''} onChange={onChange} />

  if (field.type === 'textarea' || field.type === 'richtext' || componentId === 'ManualSection' && /\/(html|css|javascript)$/.test(field.path)) {
    return (
      <label className="grid gap-1">
        {label}
        <textarea
          rows={4}
          className={controlClass}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
    )
  }

  return (
    <label className="grid gap-1">
      {label}
      <input
        className={controlClass}
        value={typeof value === 'string' ? value : ''}
        placeholder={field.help}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

function ShowcaseItemsEditor({ credentials, items, imageUrls, projectId, onChange }: { credentials: boolean; items: Array<Record<string, string>>; imageUrls: Record<string, string>; projectId: string; onChange: (value: unknown) => void }) {
  const name = credentials ? 'credential' : 'project or product'
  const fields = credentials ? [['title', 'Credential / award name'], ['issuer', 'Issuing organization'], ['year', 'Year (optional)'], ['description', 'Details (optional)'], ['href', 'Verification link (optional)']] : [['title', 'Project / product name'], ['category', 'Category (used by filters)'], ['description', 'Description'], ['href', 'Project or product page link (optional)'], ['linkLabel', 'Link button text']]
  return <div className="grid gap-3">
    <p className="text-xs text-neutral-500">{credentials ? 'Upload your real award, certification or partner badge. Images fit inside the card without cropping.' : 'Show your work or products with a large image, short description and optional page link. Matching categories are grouped automatically.'}</p>
    {!items.length && <p className="rounded-lg border border-dashed p-4 text-sm">Add your first {name} below. This section stays hidden in Preview until it has an item.</p>}
    {items.map((item, index) => <details key={index} open className="rounded-lg border border-neutral-200 p-3">
      <summary className="cursor-pointer text-sm font-medium">{index + 1}. {item.title || `New ${name}`}</summary>
      <div className="mt-3 grid gap-3">
        <ImageField projectId={projectId} imageUrls={imageUrls} value={item.imageUrl || ''} onChange={imageUrl => onChange(items.map((entry, position) => position === index ? { ...entry, imageUrl } : entry))} />
        {[...fields, ['imageAlt', 'Image description (accessibility)']].map(([key, label]) => <label key={key} className="grid gap-1 text-xs">{label}{key === 'description' ? <textarea className={controlClass} rows={3} value={item[key!] || ''} onChange={event => onChange(items.map((entry, position) => position === index ? { ...entry, [key!]: event.target.value } : entry))} /> : <input className={controlClass} value={item[key!] || ''} placeholder={key === 'href' ? '/work/project-name or https://…' : undefined} onChange={event => onChange(items.map((entry, position) => position === index ? { ...entry, [key!]: event.target.value } : entry))} />}</label>)}
        <div className="flex flex-wrap gap-3 text-xs">{[-1, 1].map(direction => <button key={direction} type="button" disabled={index + direction < 0 || index + direction >= items.length} className="disabled:opacity-30" onClick={() => { const next = [...items]; [next[index], next[index + direction]] = [next[index + direction]!, next[index]!]; onChange(next) }}>{direction < 0 ? 'Move up' : 'Move down'}</button>)}<button type="button" className="text-red-700" onClick={() => onChange(items.filter((_, position) => position !== index))}>Remove {name}</button></div>
      </div>
    </details>)}
    <button type="button" disabled={items.length >= 60} className="rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-50" onClick={() => onChange([...items, { title: '', imageUrl: '', imageAlt: '', description: '', href: '', ...(credentials ? { issuer: '', year: '' } : { category: '', linkLabel: 'Explore project' }) }])}>+ Add {name}</button>
  </div>
}

export function ImageField({
  imageUrls,
  projectId,
  value,
  onChange,
}: {
  imageUrls: Record<string, string>
  projectId: string
  value: string
  onChange: (value: string) => void
}) {
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [error, setError] = useState<string>()
  const [uploaded, setUploaded] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState<string>()
  const localPreviews = useRef<string[]>([])
  useEffect(() => () => { localPreviews.current.forEach((url) => URL.revokeObjectURL(url)) }, [])
  const images = { ...imageUrls, ...uploaded }
  const imageName = (url: string) => {
    try { return decodeURIComponent(new URL(url, 'http://local').pathname.split('/').pop() ?? 'Project image').replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i, '') }
    catch { return 'Project image' }
  }

  return (
    <div className="grid gap-2">
      {value && (
        <LibraryThumbnail key={images[value] ?? value} src={images[value] ?? value} name="Selected cover image" />
      )}
      <button type="button" aria-expanded={libraryOpen} className="rounded-md border border-neutral-300 px-3 py-2 text-xs font-medium" onClick={() => setLibraryOpen((open) => !open)}>
        {libraryOpen ? 'Close image library' : `Choose from image library (${Object.keys(images).length})`}
      </button>
      {libraryOpen && <div className="grid gap-2 rounded-md border border-neutral-200 p-2" role="region" aria-label="Project image library">
        <p className="text-xs text-neutral-500">Uploaded and AI-generated project images. Select one to use it here.</p>
        {Object.keys(images).length === 0 ? <p className="text-xs">No images yet. Upload an image below.</p> :
          <div className="grid max-h-[28rem] grid-cols-2 content-start auto-rows-max gap-2 overflow-y-auto" style={{ gridAutoRows: 'max-content', alignContent: 'start' }}>
            {Object.entries(images).map(([url, preview]) => <button key={url} type="button" aria-label={`Use ${imageName(url)}`} aria-pressed={value === url} title={imageName(url)} style={{ display: 'block', height: 164, minHeight: 164, flexShrink: 0 }} className={`group relative min-w-0 overflow-hidden rounded-lg border-2 bg-neutral-50 text-left focus-visible:outline-2 focus-visible:outline-sky-600 ${value === url ? 'border-sky-600 ring-1 ring-sky-600' : 'border-neutral-200 hover:border-sky-400'}`} onClick={() => { onChange(url); setLibraryOpen(false); setNotice('Image selected. Save the website to keep this section change.'); setError(undefined) }}>
              <LibraryThumbnail key={preview} src={preview} name={imageName(url)} />
              {value === url && <span className="absolute right-1 top-1 rounded-full bg-sky-700 px-2 py-0.5 text-[10px] font-medium text-white">Selected</span>}
              <span className="block truncate bg-white px-2 py-1.5 text-[10px] text-neutral-600">{imageName(url)}</span>
            </button>)}
          </div>}
      </div>}
      <label className="grid gap-1 text-xs text-neutral-600">Upload from computer
        <input type="file" accept="image/*" disabled={uploading} className="max-w-full text-xs"
          onChange={async (event) => {
            const input = event.currentTarget
            const file = input.files?.[0]
            if (!file) return
            setUploading(true)
            setError(undefined)
            setNotice(undefined)
            try {
              const body = new FormData()
              body.set('projectId', projectId)
              body.set('kind', 'IMAGE')
              body.set('file', file)
              const response = await fetch('/api/assets', { method: 'POST', body })
              const payload = await response.json() as { asset?: { url: string }; error?: string }
              if (!response.ok || !payload.asset) throw new Error(payload.error || 'Could not upload this image. Please try again.')
              const url = payload.asset.url
              const localPreview = URL.createObjectURL(file)
              localPreviews.current.push(localPreview)
              setUploaded((current) => ({ ...current, [url]: localPreview }))
              onChange(url)
              setNotice('Image saved to your project library. Save the website to keep this section change.')
              router.refresh()
            } catch (uploadError) {
              setError(uploadError instanceof Error ? uploadError.message : 'Image upload failed. Please try again.')
            } finally {
              setUploading(false)
              input.value = ''
            }
          }} />
      </label>
      <details className="text-xs text-neutral-500"><summary className="cursor-pointer">Use an image URL</summary><input aria-label="Image URL" className={controlClass} value={value} onChange={(event) => onChange(event.target.value)} /></details>
      {value && <button type="button" className="text-left text-xs text-neutral-600 underline" onClick={() => { onChange(''); setNotice('Image removed from this section. It remains in the library.') }}>Clear image selection</button>}
      {uploading && <p role="status" className="text-xs text-neutral-500">Uploading and saving image…</p>}
      {notice && <p role="status" className="text-xs text-neutral-600">{notice}</p>}
      {error && <ErrorNotice code="WT-UPLOAD-001" message={error} className="text-xs text-red-700" />}
    </div>
  )
}

export function LibraryThumbnail({ src, name }: { src: string; name: string }) {
  const [failure, setFailure] = useState<string>()
  const [attempt, setAttempt] = useState(0)
  const thumbnail = src.startsWith('/api/projects/') && src.includes('/editor-image?') ? `${src}&thumbnail=1&attempt=${attempt}` : src
  return <span className="relative flex h-32 w-full items-center justify-center overflow-hidden rounded bg-neutral-100" style={{ display: 'flex', width: '100%', height: 128, minHeight: 128, flexShrink: 0 }}>
    {/* Never hide decoded images while waiting for a React load event. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img key={thumbnail} src={thumbnail} alt={name} loading="lazy" decoding="async" width={480} height={320} style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain' }} onLoad={() => setFailure(undefined)} onError={() => setFailure(thumbnail)} className="h-full w-full object-contain" />
    {failure === thumbnail && <span className="absolute inset-0 flex items-center justify-center bg-neutral-100 px-2 text-center text-[10px] text-neutral-600">Image could not load. <span className="ml-1 underline" onClick={(event) => { event.stopPropagation(); setFailure(undefined); setAttempt((value) => value + 1) }}>Retry</span></span>}
  </span>
}

/// Repeater editing for array props (service cards, gallery items, FAQ rows).
function ListField({
  componentId,
  template,
  field,
  value,
  onChange,
}: {
  componentId: string
  template: unknown
  field: EditorField
  value: unknown[]
  onChange: (value: unknown[]) => void
}) {

  return (
    <div className="grid gap-2 rounded-md border border-neutral-200 p-3">
      <span className="text-xs font-medium text-neutral-700">{field.label}</span>
      {value.map((entry, index) => (
        <div key={index} className="grid gap-1 rounded border border-neutral-200 p-2">
          {typeof entry === 'object' && entry !== null ? (
            Object.entries({ ...(entry as Record<string, unknown>), ...(template && typeof template === 'object' && !Array.isArray(template) ? Object.fromEntries(Object.entries(template).map(([key, fallback]) => [key, (entry as Record<string, unknown>)[key] ?? fallback])) : {}) }).map(([key, entryValue]) => (
              <NestedValueEditor key={key} componentId={componentId} path={`${field.path}/${index}/${key}`} label={key === 'children' ? 'Submenu links' : key} value={entryValue} onChange={(updated) => onChange(value.map((item, position) => position === index ? { ...(template as Record<string, unknown>), ...(item as Record<string, unknown>), [key]: updated } : item))} />
            ))
          ) : (
            <input
              className={controlClass}
              value={String(entry ?? '')}
              onChange={(event) => onChange(value.map((item, position) => (position === index ? event.target.value : item)))}
            />
          )}
          <div className="flex gap-2 text-[11px]">
            <button
              type="button"
              className="text-neutral-600 hover:underline"
              disabled={index === 0}
              onClick={() => {
                const next = [...value]
                const [moved] = next.splice(index, 1)
                next.splice(index - 1, 0, moved)
                onChange(next)
              }}
            >
              Move up
            </button>
            <button
              type="button"
              className="text-red-600 hover:underline"
              onClick={() => onChange(value.filter((_, position) => position !== index))}
            >
              Remove
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="rounded border border-neutral-300 px-2 py-1 text-xs"
        onClick={() =>
          onChange([...value, structuredClone(template)])
        }
      >
        Add item
      </button>
    </div>
  )
}

function NestedValueEditor({ componentId, path, label, value, onChange }: { componentId: string; path: string; label: string; value: unknown; onChange: (value: unknown) => void }) {
  if (componentId === 'BlogArticle' && /^\/blocks\/\d+\/body$/.test(path)) return <ListTextEditor label="Section content" value={typeof value === 'string' ? value : ''} onChange={onChange} />
  if (Array.isArray(value)) return <ListField componentId={componentId} field={{ path, label, type: 'list' }} template={listItemTemplate(componentId, path)} value={value} onChange={onChange} />
  if (value && typeof value === 'object') return <fieldset className="grid gap-2 rounded border border-neutral-200 p-2"><legend className="text-xs">{label}</legend>{Object.entries(value).map(([key, child]) => <NestedValueEditor key={key} componentId={componentId} path={`${path}/${key}`} label={key} value={child} onChange={(updated) => onChange({ ...value, [key]: updated })} />)}</fieldset>
  if (typeof value === 'boolean') return <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} />{label}</label>
  return <label className="grid gap-0.5"><span className="text-[11px] text-neutral-500">{label === 'href' ? 'Link' : label === 'label' ? 'Label' : label}</span><input className={controlClass} type={typeof value === 'number' ? 'number' : 'text'} value={typeof value === 'number' || typeof value === 'string' ? value : ''} onChange={(event) => onChange(typeof value === 'number' ? Number(event.target.value) : event.target.value)} /></label>
}

const controlClass = 'w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm'

function ManualElementsEditor({ items, imageUrls, projectId, onChange }: { items: Record<string, unknown>[]; imageUrls: Record<string, string>; projectId: string; onChange: (value: unknown) => void }) {
  const names: Record<string, string> = { form: 'Form', heading: 'Heading', text: 'Text', image: 'Image', bullets: 'Bullets', numbered: 'Numbered list', button: 'Button', quote: 'Quote', divider: 'Divider', spacer: 'Spacer', embed: 'HTML / Embed', columns: 'Columns', social: 'Social', menu: 'Menu' }
  return <div className="grid gap-3"><p className="text-xs text-neutral-600">Add your own content. Select an element on the canvas to style, resize, move, duplicate or delete it.</p>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Add element">{Object.entries(names).map(([kind, label]) => <button type="button" key={kind} disabled={items.length >= 100} className="rounded border border-violet-300 px-2 py-1 text-xs text-violet-900" onClick={() => onChange([...items, { id: crypto.randomUUID(), kind, text: kind === 'heading' ? 'Your heading' : ['bullets', 'numbered'].includes(kind) ? 'First item\nSecond item' : 'Write your content here.', headingLevel: '2', imageUrl: '', imageAlt: '', label: 'Learn more', href: '', height: kind === 'embed' ? 300 : 40, html: '', css: '', javascript: '', columns: [{ title: 'First column', body: 'Add your content.' }, { title: 'Second column', body: 'Add your content.' }], links: kind === 'menu' ? [{ label: 'Home', href: '/' }] : [] }])}>+ {label}</button>)}</div>
    {items.map((item, index) => {
      const update = (key: string, value: unknown) => onChange(items.map((entry, position) => position === index ? { ...entry, [key]: value } : entry))
      const keys = manualKeys(String(item.kind))
      return <fieldset key={String(item.id)} className="grid gap-2 rounded border p-2"><legend className="text-xs font-semibold">{index + 1}. {names[String(item.kind)]}</legend>{item.kind === 'embed' && <p className="text-xs text-neutral-500">HTML goes in HTML, CSS without style tags, and JavaScript without script tags. Runs inside its own frame in Preview/export. Set Height to fit your content. Use Integrations for scripts that must access the whole website.</p>}{keys.map(key => <FieldEditor key={key} componentId="ManualSection" imageUrls={imageUrls} projectId={projectId} field={{ path: `/items/${index}/${key}`, label: key === 'imageAlt' ? 'Image description' : key === 'href' ? 'Link URL' : key === 'headingLevel' ? 'Heading level' : key === 'text' ? 'Content' : key, type: Array.isArray(item[key]) ? 'list' : key === 'imageUrl' ? 'image' : key === 'headingLevel' ? 'select' : key === 'height' ? 'number' : ['text', 'html', 'css', 'javascript'].includes(key) ? 'textarea' : 'text', ...(key === 'headingLevel' ? { options: ['2', '3'] } : {}) }} value={item[key]} onChange={value => update(key, value)} />)}</fieldset>
    })}
  </div>
}

function manualKeys(kind: string): string[] {
  return kind === 'form' ? ['formFields', 'submitLabel', 'submissionUrl'] : kind === 'columns' ? ['columns'] : ['menu', 'social'].includes(kind) ? ['links'] : kind === 'embed' ? ['html', 'css', 'javascript', 'height'] : kind === 'image' ? ['imageUrl', 'imageAlt'] : kind === 'button' ? ['label', 'href'] : kind === 'spacer' ? ['height'] : kind === 'divider' ? [] : kind === 'heading' ? ['text', 'headingLevel'] : ['text']
}
