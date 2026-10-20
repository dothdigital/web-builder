import { contactPropsSchema, renderContactForm } from './conversion'
import { SocialLink } from './social-link'
import { embedDocument } from '../embed-document'
import { z } from 'zod'
import { defineComponent } from '../types'
import { Container, Section, Heading, Media, Cta } from '../primitives'
import { ArticleBody } from './article-body'
import { elementColor } from '../element-colors'
import { imageSizing } from '../image-sizing'

const item = z.object({
  column: z.number().int().min(1).max(5).default(1),
  id: z.string(), kind: z.enum(['heading', 'text', 'image', 'bullets', 'numbered', 'button', 'quote', 'divider', 'spacer', 'embed', 'columns', 'social', 'menu', 'form']),
  formFields: contactPropsSchema.shape.formFields.optional(),
  submitLabel: z.string().optional(),
  submissionUrl: contactPropsSchema.shape.submissionUrl,
  links: z.array(z.object({ label: z.string(), href: z.string().refine(value => !value || /^(?:\/(?!\/)|#|https?:\/\/|mailto:|tel:)/i.test(value), 'Use a valid link') })).max(20).default([]),
  columns: z.array(z.object({ title: z.string(), body: z.string() })).min(1).max(5).default([{ title: 'First column', body: 'Add your content.' }, { title: 'Second column', body: 'Add your content.' }]),
  text: z.string().default(''), headingLevel: z.enum(['2', '3']).default('2'),
  imageUrl: z.string().default(''), imageAlt: z.string().default(''),
  label: z.string().default('Learn more'), href: z.string().refine(value => !value || /^(?:\/(?!\/)|#|https?:\/\/|mailto:|tel:)/i.test(value), 'Use a page path, https URL, email or phone link').default(''),
  height: z.number().min(8).max(2000).default(40),
  html: z.string().max(50000).default(''), css: z.string().max(20000).default(''), javascript: z.string().max(50000).default(''),
})
export const manualSection = defineComponent({
  componentId: 'ManualSection', version: '1.0.0', family: 'ABOUT', name: 'Blank section',
  description: 'Build a section yourself with headings, text, images, lists and buttons.',
  aiGuidance: 'Reserved for user-authored manual content; prefer designed components for AI generation.',
  propsSchema: z.object({ sectionColumns: z.number().int().min(1).max(5).optional(), equalColumnWidths: z.boolean().default(true), equalColumnHeights: z.boolean().default(true), items: z.array(item).max(100).default([]) }), tokenDeps: ['typography.bodyFamily'],
  editorFields: [{ path: '/items', label: 'Section elements', type: 'list' }], fixture: { items: [], equalColumnWidths: true, equalColumnHeights: true },
  render: ({ props, context }) => {
    const objects = props.items.map((entry, i) => {
      const path = `/items/${i}`
      const body = `${path}/text`
      if (entry.kind === 'button') return <Cta key={entry.id} data-awb-element={path} label={entry.label} href={entry.href || '#'} style={elementColor(props, path)} />
      if (entry.kind === 'columns') return <div key={entry.id} data-awb-element={path} data-awb-object-columns={entry.columns.length} style={{ marginBottom: '1rem', minWidth: 0, width: '100%', gap: 'min(1.5rem, 3%)', ...elementColor(props, path), display: 'grid', gridTemplateColumns: `repeat(${entry.columns.length},minmax(0,1fr))`, '--awb-object-tablet-columns': Math.min(entry.columns.length, 2) } as import('react').CSSProperties}>
        <style>{`@media(max-width:479px){[data-awb-object-columns]{grid-template-columns:minmax(0,1fr)!important}}@media(min-width:480px) and (max-width:767px){[data-awb-object-columns]{grid-template-columns:repeat(var(--awb-object-tablet-columns),minmax(0,1fr))!important}}`}</style>
        {entry.columns.map((column, j) => <div key={j} data-awb-element={`${path}/columns/${j}`} style={{ minWidth: 0, overflowWrap: 'anywhere', ...elementColor(props, `${path}/columns/${j}`) }}><Heading level={3} data-awb-element={`${path}/columns/${j}/title`} style={elementColor(props, `${path}/columns/${j}/title`)}>{column.title}</Heading><ArticleBody data-awb-element={`${path}/columns/${j}/body`} path={`${path}/columns/${j}/body`} text={column.body} style={elementColor(props, `${path}/columns/${j}/body`)} /></div>)}
      </div>
      return <div key={entry.id} data-awb-element={path} style={{ marginBottom: '1rem', ...elementColor(props, path) }}>
        {entry.kind === 'form' && renderContactForm(contactPropsSchema.parse({ heading: '', formFields: entry.formFields ?? defaultFormFields, submitLabel: entry.submitLabel ?? 'Submit', submissionUrl: entry.submissionUrl }), context, path)}

        {entry.kind === 'menu' && <nav aria-label="Section menu" style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>{entry.links.filter(link => link.href.trim()).map((link, j) => <a key={j} data-awb-element={`${path}/links/${j}`} href={link.href} style={{ color: 'inherit', ...elementColor(props, `${path}/links/${j}`) }}>{link.label}</a>)}</nav>}
        {entry.kind === 'social' && <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>{entry.links.filter(link => link.href.trim()).map((link, j) => <SocialLink key={j} platform={link.label} href={link.href} />)}{!entry.links.length && context.editing && <p>Add your social profile links in Properties.</p>}</div>}
        {entry.kind === 'heading' && <Heading level={Number(entry.headingLevel) as 2 | 3} data-awb-element={body} style={elementColor(props, body)}>{entry.text}</Heading>}
        {entry.kind === 'text' && <ArticleBody data-awb-element={body} path={body} text={entry.text} style={elementColor(props, body)} />}
        {['bullets', 'numbered'].includes(entry.kind) && <ArticleBody data-awb-element={body} path={body} text={entry.text.split('\n').filter(line => line.trim()).map((line, index) => `${entry.kind === 'bullets' ? '-' : `${index + 1}.`} ${line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '')}`).join('\n')} style={elementColor(props, body)} />}
        {entry.kind === 'image' && (entry.imageUrl ? <Media editing={context.editing} data-awb-element={`${path}/imageUrl`} src={entry.imageUrl} alt={entry.imageAlt} ratio="16 / 9" sizeStyle={imageSizing(props, `${path}/imageUrl`)} /> : context.editing ? <div role="img" aria-label="Empty image — click to upload or generate" data-awb-element={`${path}/imageUrl`} style={{ minHeight: 120, border: '1px dashed currentColor', padding: 24 }}>Click to upload an image or generate with AI.</div> : null)}
        {entry.kind === 'quote' && <blockquote data-awb-element={body} style={{ borderLeft: '3px solid currentColor', paddingLeft: '1.5rem', whiteSpace: 'pre-line', ...elementColor(props, body) }}>{entry.text}</blockquote>}
        {entry.kind === 'embed' && (context.editing ? <div data-awb-element={`${path}/html`} style={{ minHeight: Math.max(80, entry.height), border: '1px dashed currentColor', padding: 24 }}>HTML / Embed — select this object, then use Edit HTML in the top toolbar. Open Preview to run your code.</div> : <iframe title={`Custom HTML component ${i + 1}`} srcDoc={embedDocument(entry.html, entry.css, entry.javascript)} sandbox="allow-scripts allow-forms allow-popups" referrerPolicy="no-referrer" style={{ display: 'block', width: '100%', height: entry.height, border: 0 }} />)}
        {entry.kind === 'divider' && <hr style={{ border: 0, borderTop: '1px solid currentColor', opacity: 0.4 }} />}
        {entry.kind === 'spacer' && <div style={{ height: entry.height }} />}
      </div>
    })
    if (!props.sectionColumns) return <Section><Container>{props.items.length === 0 && context.editing && <p style={{ minHeight: 120, opacity: 0.65 }}>Blank section — add elements in the Properties panel.</p>}{objects}</Container></Section>
    const count = props.sectionColumns
    return <Section><Container><div style={{ containerType: 'inline-size', containerName: 'awb-columns' }}>
      <style>{`@container awb-columns (max-width:699px){[data-awb-columns-grid]{grid-template-columns:minmax(0,1fr)!important;grid-auto-rows:auto!important}}@container awb-columns (min-width:700px) and (max-width:999px){[data-awb-columns-grid]{grid-template-columns:repeat(var(--awb-tablet-columns),minmax(0,1fr))!important}}`}</style>
      <div data-awb-columns-grid="true" style={{ display: 'grid', gridTemplateColumns: props.equalColumnWidths ? `repeat(${count},minmax(0,1fr))` : `repeat(${count},minmax(160px,auto))`, gap: '1.5rem', alignItems: props.equalColumnHeights ? 'stretch' : 'start', gridAutoRows: props.equalColumnHeights ? '1fr' : 'auto', '--awb-tablet-columns': Math.min(count, 2) } as import('react').CSSProperties}>
        {Array.from({ length: count }, (_, index) => {
          const column = index + 1
          const entries = objects.filter((_, i) => Math.min(props.items[i]!.column, count) === column)
          if (!entries.length && !context.editing) return null
          return <div key={column} data-awb-element={`/columnSlots/${column}`} data-awb-column={column} style={{ minWidth: 0, overflowWrap: 'anywhere', ...(context.editing ? { border: '1px dashed var(--awb-border)', borderRadius: 8, padding: 12, minHeight: 140 } : {}) }}>
            {context.editing && <p style={{ fontSize: 12, color: 'var(--awb-muted)', margin: '0 0 12px' }}>Column {column}</p>}
            {entries.length ? entries : <p style={{ fontSize: 13 }}>Add images, text and more in this column’s Properties.</p>}
          </div>
        })}
      </div>
    </div></Container></Section>
  },
})

const defaultFormFields = [
  { name: 'name', label: 'Name', type: 'text', required: true },
  { name: 'email', label: 'Email', type: 'email', required: true },
  { name: 'phone', label: 'Phone', type: 'tel', required: false },
  { name: 'message', label: 'Message', type: 'textarea', required: true },
]
