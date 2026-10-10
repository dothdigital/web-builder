import { randomUUID } from 'node:crypto'
import { prisma } from '@awb/database'
import { createAiProvider } from '@awb/ai'
import { getComponent, registryCatalogue } from '@awb/component-registry'
import { websiteModelSchema } from '@awb/website-model'
import { applyPageRewrite } from './page-rewrite'
import { validateGeneratedSection } from './generated-section'
export async function generateAiSection(
  projectId: string,
  input: { model: unknown; pageId: string; componentId: string; instruction: string },
) {
  const model = websiteModelSchema.parse(input.model)
  const page = model.pages.find((entry) => entry.id === input.pageId)
  const automatic = input.componentId === 'auto'
  const definition = getComponent(input.componentId)
  if (!page || (!automatic && (!definition || ['HEADER', 'FOOTER'].includes(definition.family)))) throw new Error('Choose a valid page section')
  if (definition?.family === 'HERO' && page.sections.some((section) => getComponent(section.componentId)?.family === 'HERO')) throw new Error('This page already has a hero. Edit or replace that hero instead.')
  if (typeof input.instruction !== 'string' || input.instruction.length > 4000) throw new Error('Keep the section description under 4,000 characters')
  const provider = createAiProvider()
  if (provider.name !== 'openai') throw new Error('AI section generation requires the configured OpenAI provider. Placeholder content has not been added.')
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, include: { businessProfile: true, collections: { include: { items: true } }, assets: { select: { url: true, altText: true, kind: true } } } })
  const section = { id: `section-${randomUUID()}`, componentId: definition?.componentId ?? 'AiSectionChoice', componentVersion: definition?.version ?? '1.0.0', hidden: false, props: {} as Record<string, unknown> }
  const context = { ...model, pages: model.pages.map((entry) => entry.id === page.id ? { ...entry, sections: [...entry.sections, section] } : entry) }
  const instruction = [
    automatic ? 'Choose the most suitable component from the catalogue for the requested section. The target props must be an object with exactly componentId (the chosen catalogue ID) and props (the complete content object for that component). Return add operations for /componentId and /props. Do not use move operations. Use ABOUT story for Who we are, ABOUT steps for methodology, ABOUT cards for differentiators or service areas, SERVICES for offerings, and other supported components when more suitable. Do not choose HERO, HEADER or FOOTER.' : 'Create complete original content for a NEW section with empty props. Return add operations for every required prop and meaningful optional content using the component schema. Do not use move operations or change anything outside its props.',
    'Use the business facts and existing website below to match the tone, audience, design and page purpose. Fulfil the requested topic without repeating nearby sections. Use supplied facts only: never fabricate reviews, team members, credentials, locations, prices, metrics or promises. For reviews use only supplied testimonial collection entries.',
    'Use existing relevant asset URLs for images, or empty image fields if none is suitable. Do not invent URLs. Use existing page paths for navigation. Keep headings H2 except an explicitly selected hero. Background customization should stay at defaults unless requested.',
    'Use PortfolioShowcase for real products or completed work and CredentialsShowcase for real awards, certifications or partner badges. Only include items and their images explicitly identified by the user in this request or existing website. Do not repurpose unrelated stock images as product photos or award badges. Leave items empty if these facts have not been supplied; the editor lets the user upload them.',
    ...(input.componentId === 'FaqAccordion' ? ['Generate 4–6 distinct questions and clear answers specific to THIS page, its audience, search intent and keywords. Use the page content and supplied facts; never invent prices, guarantees or policies. Do not repeat FAQs from other pages.'] : []),
    `User request: ${input.instruction.trim() || `Add a useful ${(definition?.family ?? 'custom').toLowerCase()} section that is missing from this page.`}`,
    `Component contract: ${JSON.stringify(automatic ? registryCatalogue().filter((entry) => !['HEADER', 'FOOTER', 'HERO'].includes(entry.family)) : registryCatalogue().find((entry) => entry.componentId === definition?.componentId))}`,
    `Business: ${JSON.stringify(project.businessProfile)}`,
    `Collections: ${JSON.stringify(project.collections.map((collection) => ({ type: collection.type, items: collection.items.map((item) => item.data) })))}`,
    `Available images: ${JSON.stringify(project.assets)}`,
    `Current website: ${JSON.stringify(model)}`,
  ].join('\n\n')
  const result = await provider.patchSection(instruction, context, { pageId: page.id, sectionId: section.id })
  return { ...section, ...validateGeneratedSection(input.componentId, result.data.operations) }
}

export async function rewritePageWithAi(projectId: string, input: { model: unknown; pageId: string; instruction: string }) {
  if (typeof input.instruction !== 'string' || !input.instruction.trim() || input.instruction.length > 4000) throw new Error('Describe the changes you want in 1–4,000 characters.')
  const model = websiteModelSchema.parse(input.model)
  const page = model.pages.find((entry) => entry.id === input.pageId)
  if (!page) throw new Error('Page not found')
  const provider = createAiProvider()
  if (provider.name !== 'openai') throw new Error('OpenAI must be configured to rewrite this page.')
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, include: { businessProfile: true, collections: { include: { items: true } } } })
  const targetId = `rewrite-${randomUUID()}`
  const context = { ...model, pages: model.pages.map((entry) => entry.id === page.id ? { ...entry, sections: [...entry.sections, { id: targetId, componentId: 'PageCopy', componentVersion: '1.0.0', hidden: true, props: page as unknown as Record<string, unknown> }] } : entry) }
  const instruction = [
    'Rewrite the selected page according to the user request. The target props contain the page object. Return only replace operations relative to that object.',
    'Allowed paths: /title, /h1, /seo/title, /seo/description, and existing textual fields under /sections/N/props. Rewrite relevant headings, body, intro and card descriptions. Preserve URLs, images, alt text, styling, layout, section IDs and order. Never change reviews, contact details, statistics, credentials or prices. Keep facts accurate; do not invent guarantees or business facts. Keep the H1 and hero heading consistent. Change SEO only when relevant to the request.',
    `Request: ${input.instruction}`,
    `Business facts: ${JSON.stringify(project.businessProfile)}`,
    `Supplied collections: ${JSON.stringify(project.collections.map((collection) => ({ type: collection.type, items: collection.items.map((item) => item.data) })))}`,
    `Website context: ${JSON.stringify(model)}`,
  ].join('\n\n')
  const result = await provider.patchSection(instruction, context, { pageId: page.id, sectionId: targetId })
  const rewritten = applyPageRewrite(page, result.data.operations)
  return { page: rewritten, reason: result.data.reason }
}

export async function enrichServiceDetailPages(projectId: string, source: import('@awb/website-model').WebsiteModel, onPage?: (path:string)=>void) {
  const model = {...source,pages:source.pages.map(page=>({...page,sections:page.sections.map(section=>section.componentId==='ServiceDetail'?{...section,props:{...section.props,
    contentBlocks:Array.isArray(section.props.contentBlocks)&&section.props.contentBlocks.length ? section.props.contentBlocks : Array.from({length:3},()=>({heading:'',body:''})),
    faqs:Array.isArray(section.props.faqs)&&section.props.faqs.length ? section.props.faqs : Array.from({length:3},()=>({question:'',answer:''})),
  }}:section)}))}
  const targets = model.pages.filter(page=>page.sections.some(section=>section.componentId==='ServiceDetail' && !(section.props.contentBlocks as Array<{body:string}>).some(block=>block.body.trim())))
  const pages = new Map<string, import('@awb/website-model').WebsitePage>()
  // Limit concurrent requests while each page remains an independent rewrite.
  for (let start=0;start<targets.length;start+=2) {
    const results = await Promise.allSettled(targets.slice(start,start+2).map(async page=>{
      onPage?.(page.path)
      const rewritten = await rewritePageWithAi(projectId,{model,pageId:page.id,instruction:[
        `Complete the thin service detail page for ${page.title}. Keep its title, H1, breadcrumb text and all paths unchanged.`,
        'Fill the ServiceDetail intro body with 80–120 useful words, all three contentBlocks with topic-specific headings and 45–80 words each, and all three faqs with distinct questions and 25–50 word answers. Aim for 300–450 words in total. Fill every empty topic and FAQ string; do not return a summary-only page.',
        'Base every product statement on the saved business description and existing supplied service text. Explain those supplied concepts clearly without inventing coverage limits, eligibility, waiting periods, fees, insurers, exclusions, regulatory rules, investment returns, tax rules or promises. Do not interpret policy terms or give personalized financial advice.',
        'For combined categories, distinguish the supplied products in the topic blocks. For Visitor Insurance distinguish Super Visa and Visitor to Canada; for Living Benefits distinguish critical illness and disability; for Travel & Student Insurance distinguish Canadian travel and international student cover; for Registered Savings distinguish the stated RESP, TFSA, RRSP and FHSA purposes without adding tax or contribution rules.',
        'Use plain professional language. Describe relevant needs, the information a reader can include in an enquiry, and questions to discuss with Shreeram. Do not claim a consultation method, claims service, application workflow, response time, or additional qualification that the brief did not supply. Do not repeat the other service pages. Plain paragraphs and optional bullet lists only; no Markdown headings in body strings.',
        'Update SEO description if needed, preserving the page path and all images, layout, related links and contact URL.',
      ].join('\n')})
      const detail = rewritten.page.sections.find(section=>section.componentId==='ServiceDetail')!
      const blocks = detail.props.contentBlocks as Array<{heading:string;body:string}>
      const faqs = detail.props.faqs as Array<{question:string;answer:string}>
      const words = [detail.props.body,...blocks.map(block=>block.body),...faqs.map(faq=>faq.answer)].join(' ').trim().split(/\s+/).length
      if (words<250 || blocks.some(block=>!block.heading.trim()||!block.body.trim()) || faqs.some(faq=>!faq.question.trim()||!faq.answer.trim())) throw new Error(`Incomplete service content for ${page.path}`)
      return rewritten.page
    }))
    for (const result of results) {
      if (result.status==='rejected') throw result.reason
      pages.set(result.value.id,result.value)
    }
  }
  return {...model,pages:model.pages.map(page=>pages.get(page.id)||page)}
}

export async function createContentWithAi(projectId: string, raw: { model: unknown; request: unknown }) {
  const { contentRequestSchema, contentPath, validateContentRequest, generatedContentPage } = await import('./content-creation')
  const input = contentRequestSchema.parse(raw.request)
  if (input.kind === 'blog' && !input.coverImageUrl) throw new Error('Choose or upload a cover image for this blog post before generating.')
  const model = websiteModelSchema.parse(raw.model)
  validateContentRequest(model, input)
  const provider = createAiProvider()
  if (provider.name !== 'openai') throw new Error('Configure OpenAI before creating content. No placeholder page was added.')
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, include: { businessProfile: true } })
  const id = `page-${randomUUID()}`
  const sectionId = `content-${randomUUID()}`
  const target = { id, path: contentPath(input), title: input.topic, h1: input.topic, pageType: 'CUSTOM', seo: { title: input.topic, description: '', index: false }, sections: [{ id: sectionId, componentId: 'ContentDraft', componentVersion: '1.0.0', hidden: true, props: {} }] }
  const context = { ...model, pages: [...model.pages, target] }
  const catalogue = registryCatalogue().filter((entry) => input.kind === 'blog' ? (entry.componentId === 'BlogArticle' || (input.includeFaq && entry.componentId === 'FaqAccordion')) : !['HEADER', 'FOOTER'].includes(entry.family) && !['BlogArticle', 'BlogListing'].includes(entry.componentId))
  const instruction = [
    'Create original website content. Return exactly ONE add operation at /page whose value is a complete page object: title, h1, seo:{title,description,index:true}, sections:[{id,componentId,componentVersion:"1.0.0",hidden:false,props}]. Do not return other operations.',
    input.kind === 'blog' ? 'Create one BlogArticle section with 4–8 useful H2 blocks, original detailed prose and a clear introduction. Each block has heading, body and links. Use plain text paragraphs, with - prefixed lines for bullet lists and 1. prefixed lines for numbered steps where helpful. Each list item must be on its own line. Do not use HTML or other Markdown formatting.' : 'Create a complete modern page with 4–6 complementary sections. Exactly one HERO section with heading matching h1. Choose the most appropriate registry layouts for the topic and conversion goal.',
    input.includeFaq ? 'Include a FaqAccordion section with 4–6 questions and answers specifically addressing this page topic, keyword, audience and goal. Answers must use supplied facts only. Place it after the main explanation.' : 'Do not include a FAQ section unless explicitly requested in the brief.',
    'SEO title maximum 60 characters; unique meta description 30–160 characters. Use the main keyword naturally in title, H1, introduction and relevant subheadings. Address audience, intent and location without stuffing keywords. No ranking promises.',
    'Use only supplied business facts. Do not invent credentials, statistics, quotations, testimonials, pricing or contact details. Do not invent authors or image URLs; omit image fields if no supplied image is relevant. Do not include scripts, layout overrides or freeElements.',
    input.internalPaths.length ? 'Include each selected internal path once or more, in relevant contextual links or CTAs with descriptive anchor text. Never link to unselected paths or external URLs. Use absolute site paths, not preview URLs.' : 'Choose 1–3 relevant pages from the existing pages and link to them contextually using descriptive anchor text. At least one internal link is required. Only use existing absolute site paths; never invent links or use external URLs.',
    `Brief: ${JSON.stringify(input)}`,
    `Business facts: ${JSON.stringify(project.businessProfile)}`,
    `Existing pages: ${JSON.stringify(model.pages.map((page) => ({ path: page.path, title: page.title, description: page.seo.description })))}`,
    `Component schemas: ${JSON.stringify(catalogue)}`,
  ].join('\n\n')
  const result = await provider.patchSection(instruction, context, { pageId: id, sectionId })
  return { page: generatedContentPage(model, input, result.data.operations, id), reason: result.data.reason }
}

export async function patchContentSection(_projectId: string, input: { model: unknown; pageId: string; sectionId: string; instruction: string }) {
  const model = websiteModelSchema.parse(input.model)
  const section = model.pages.find((page) => page.id === input.pageId)?.sections.find((entry) => entry.id === input.sectionId)
  if (!section) throw new Error('Section not found')
  const provider = createAiProvider()
  const result = await provider.patchSection(input.instruction, model, { pageId: input.pageId, sectionId: input.sectionId })
  const generated = validateGeneratedSection(section.componentId, [{ op: 'replace', path: '', value: section.props }, ...result.data.operations])
  return { ...section, ...generated }
}
