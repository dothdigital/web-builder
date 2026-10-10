import { BalancedGrid } from '../balanced-grid'
import { ArticleBody } from './article-body'
import { z } from 'zod'
import { defineComponent } from '../types'
import { Container, Section, Heading, Prose, Media } from '../primitives'
import { elementColor } from '../element-colors'
import { imageSizing } from '../image-sizing'
const link = z.object({ label: z.string().min(1), href: z.string().regex(/^\/[a-z0-9\-/]*$/) })
const articleSchema = z.object({
  heading: z.string().min(1), intro: z.string().min(1), imageUrl: z.string().optional(), imageAlt: z.string().default(''),
  author: z.string().default(''),
  blocks: z.array(z.object({ heading: z.string().min(1), body: z.string().min(1), links: z.array(link).max(4).default([]) })).min(2).max(12),
})
export const blogArticle = defineComponent({
  componentId: 'BlogArticle', version: '1.0.0', family: 'HERO', name: 'Blog article', description: 'Long-form article with related internal links.', aiGuidance: 'Use for a blog post with one H1 and useful H2 sections. No fabricated facts. In block body strings, use - prefixed lines for bullets and 1. prefixed lines for numbered steps when useful; no HTML.',
  propsSchema: articleSchema, tokenDeps: ['typography.bodyFamily'],
  editorFields: [{ path: '/heading', label: 'Article title', type: 'text', headingLevel: 1 }, { path: '/intro', label: 'Introduction', type: 'textarea' }, { path: '/author', label: 'Author', type: 'text' }, { path: '/imageUrl', label: 'Cover image', type: 'image' }, { path: '/imageAlt', label: 'Image description', type: 'text' }, { path: '/blocks', label: 'Article sections', type: 'list' }],
  fixture: { heading: 'Insights from our team', intro: 'Practical ideas and helpful guidance.', author: '', imageAlt: '', blocks: [{ heading: 'Getting started', body: 'Introduce the topic here.', links: [] }, { heading: 'Next steps', body: 'Explain the next steps here.', links: [] }] },
  render: ({ props }) => <Section><Container><article style={{ maxWidth: '780px', margin: '0 auto' }}>
    <Heading level={1} data-awb-element="/heading" style={elementColor(props, '/heading')}>{props.heading}</Heading>
    {props.author && <p data-awb-element="/author">By {props.author}</p>}
    <Prose data-awb-element="/intro" style={elementColor(props, '/intro')}>{props.intro}</Prose>
    {props.imageUrl && <Media data-awb-element="/imageUrl" src={props.imageUrl} alt={props.imageAlt} ratio="16 / 9" sizeStyle={imageSizing(props, '/imageUrl')} />}
    {props.blocks.map((block, i) => <section key={i} data-awb-element={`/blocks/${i}`} style={{ marginTop: '2.5rem', ...elementColor(props, `/blocks/${i}`) }}>
      <Heading level={2} data-awb-element={`/blocks/${i}/heading`} style={elementColor(props, `/blocks/${i}/heading`)}>{block.heading}</Heading>
      <ArticleBody data-awb-element={`/blocks/${i}/body`} path={`/blocks/${i}/body`} text={block.body} style={elementColor(props, `/blocks/${i}/body`)} />
      {block.links.length > 0 && <ul>{block.links.map((entry, j) => <li key={j}><a href={entry.href} style={{ color: 'var(--awb-primary)', textUnderlineOffset: '0.2em' }}>{entry.label}</a></li>)}</ul>}
    </section>)}
  </article></Container></Section>,
})
const listingSchema = z.object({ heading: z.string().default('Blog'), intro: z.string().default('Ideas, insights and practical guidance.'), items: z.array(z.object({ title: z.string(), description: z.string(), href: z.string(), imageUrl: z.string().optional(), imageAlt: z.string().default('') })).default([]) })
export const blogListing = defineComponent({
  componentId: 'BlogListing', version: '1.0.0', family: 'HERO', name: 'Blog listing', description: 'Automatically lists this website’s blog posts.', aiGuidance: 'Use once on the blog index. Entries are resolved from website pages.', propsSchema: listingSchema, tokenDeps: ['palette.primary'],
  editorFields: [{ path: '/heading', label: 'Heading', type: 'text', headingLevel: 1 }, { path: '/intro', label: 'Introduction', type: 'textarea' }], fixture: { heading: 'Blog', intro: 'Ideas and insights.', items: [] },
  render: ({ props }) => <Section><Container><Heading level={1} data-awb-element="/heading">{props.heading}</Heading><Prose data-awb-element="/intro">{props.intro}</Prose>
    <BalancedGrid count={props.items.length} minimumWidth={280}>{props.items.map((item) => <article key={item.href} style={{ border: '1px solid var(--awb-border)', borderRadius: 'var(--awb-radius)', overflow: 'hidden', background: 'var(--awb-surface)' }}>
      {item.imageUrl && <Media src={item.imageUrl} alt={item.imageAlt} ratio="16 / 9" />}
      <div style={{ padding: '1.5rem' }}><Heading level={2}><a href={item.href} style={{ color: 'inherit', textDecoration: 'none' }}>{item.title}</a></Heading><Prose>{item.description}</Prose><a href={item.href} style={{ color: 'var(--awb-primary)' }}>Read article →</a></div>
    </article>)}</BalancedGrid>
    {!props.items.length && <p>Your articles will appear here when added to the website.</p>}
  </Container></Section>,
})
