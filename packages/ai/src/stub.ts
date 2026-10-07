import type { AiPatch, DesignDna, DesignTokens, WebsiteModel, WebsiteSection } from '@awb/website-model'
import { designDirections } from '@awb/website-model'
import { defaultTokens, listComponents, templateGenerationComponents, templateCopyCatalogue, initialTemplateProps, setTemplateHeading } from '@awb/component-registry'
import type {
  BriefAnalysis,
  DesignDirections,
  FollowUpQuestions,
  ImagePlan,
  PageContent,
  ReviewReport,
  SitePlan,
} from './contracts'
import type {
  AiProvider,
  AiProviderConfig,
  AiResult,
  GeneratedImage,
  GenerationBrief,
  ImageSlotRequest,
} from './provider'
import type { AiTask } from './models'
import { resolveRouting } from './models'
import { SeededRandom } from './random'
import { hslToHex, paletteFromLogoColors, readableForeground } from './color'

const headingFamilies = [
  'Georgia, "Times New Roman", serif',
  '"Playfair Display", Georgia, serif',
  '"Space Grotesk", "Helvetica Neue", sans-serif',
  '"Archivo", "Helvetica Neue", sans-serif',
  '"Libre Baskerville", Georgia, serif',
]

const bodyFamilies = [
  'Inter, system-ui, sans-serif',
  '"IBM Plex Sans", system-ui, sans-serif',
  '"Work Sans", system-ui, sans-serif',
  '"Source Sans 3", system-ui, sans-serif',
]

/// The stub mirrors the real pipeline's shape exactly: same contracts, same
/// staged calls, same validation. It exists so the product runs end to end
/// without an OpenAI key, and it varies its output by brief so uniqueness
/// checks are meaningful in local development.
export class StubAiProvider implements AiProvider {
  readonly name = 'stub'

  private readonly config: AiProviderConfig

  constructor(config: AiProviderConfig = {}) {
    this.config = config
  }

  private seedFor(brief: GenerationBrief, salt: string): SeededRandom {
    return new SeededRandom(`${this.config.seed ?? ''}:${brief.businessName}:${brief.description}:${salt}`)
  }

  private usage<T>(task: AiTask, data: T): AiResult<T> {
    return {
      data,
      usage: {
        task,
        model: `${resolveRouting(task, this.config.modelOverrides).model} (stub)`,
        inputTokens: 0,
        outputTokens: 0,
        costCents: 0,
      },
    }
  }

  async analyzeBrief(brief: GenerationBrief): Promise<AiResult<BriefAnalysis>> {
    const missingFacts: string[] = []

    if (!brief.location) missingFacts.push('Service area or address')
    if (brief.services.length === 0) missingFacts.push('List of services')
    if (brief.testimonials.length === 0) missingFacts.push('Customer testimonials')

    return this.usage('understand_brief', {
      businessType: brief.industry ?? 'local business',
      industry: brief.industry ?? 'general',
      audience: ['Local customers'],
      tone: brief.tonePreferences.length > 0 ? brief.tonePreferences : ['confident', 'warm'],
      goals: brief.goals.length > 0 ? brief.goals : ['Generate enquiries'],
      locations: brief.location ? [brief.location] : [],
      services: brief.services,
      missingFacts,
      confidence: brief.services.length > 0 && brief.location ? 0.82 : 0.55,
    })
  }

  async proposeQuestions(
    brief: GenerationBrief,
    analysis: BriefAnalysis,
  ): Promise<AiResult<FollowUpQuestions>> {
    const questions: FollowUpQuestions['questions'] = []

    if (analysis.services.length === 0) {
      questions.push({
        id: 'services',
        question: 'Which services should the site lead with?',
        why: 'Services drive the sitemap and the main navigation.',
        inputType: 'textarea',
        options: [],
        required: true,
      })
    }

    if (!brief.location) {
      questions.push({
        id: 'location',
        question: 'Where are you based, or which areas do you serve?',
        why: 'Needed for local SEO and the contact section. We will not invent an address.',
        inputType: 'text',
        options: [],
        required: true,
      })
    }

    if (!brief.hasLogo) {
      questions.push({
        id: 'logo',
        question: 'Do you have a logo you can upload?',
        why: 'If you do, we build the starting colour palette from it.',
        inputType: 'upload',
        options: [],
        required: false,
      })
    }

    if (brief.uploadedImageUrls.length === 0) {
      questions.push({
        id: 'images',
        question: 'Do you have photos to upload, or should we generate imagery for you?',
        why: 'Real photography of your own work always outperforms generated imagery.',
        inputType: 'select',
        options: ['I will upload photos', 'Generate images for me', 'Mix of both'],
        required: true,
      })
    }

    if (brief.testimonials.length === 0) {
      questions.push({
        id: 'testimonials',
        question: 'Can you paste any real customer reviews?',
        why: 'We never write fake testimonials, so the reviews section is skipped without them.',
        inputType: 'textarea',
        options: [],
        required: false,
      })
    }

    return this.usage('understand_brief', { questions: questions.slice(0, 8) })
  }

  async proposeDesignDirections(
    brief: GenerationBrief,
    analysis: BriefAnalysis,
  ): Promise<AiResult<DesignDirections>> {
    const random = this.seedFor(brief, 'directions')
    const chosen = new Set<DesignDna['direction']>()

    while (chosen.size < 3) {
      chosen.add(random.pick(designDirections))
    }

    const options = [...chosen].map((direction, index) => {
      const dnaRandom = this.seedFor(brief, `dna:${direction}`)
      const dna: DesignDna = {
        direction,
        composition: {
          symmetry: dnaRandom.pick(['symmetric', 'mostly-asymmetric', 'asymmetric']),
          density: dnaRandom.pick(['airy', 'balanced', 'dense']),
          width: dnaRandom.pick(['contained', 'wide', 'full-bleed']),
          rhythm: dnaRandom.pick(['alternating', 'cinematic', 'modular', 'story-led', 'conversion-led']),
        },
        typography: {
          headingStyle: dnaRandom.pick([
            'editorial-serif',
            'oversized-serif',
            'geometric-sans',
            'condensed-display',
            'mixed-serif-sans',
          ]),
          bodyStyle: dnaRandom.pick(['clean-sans', 'humanist-sans', 'readable-serif']),
          scale: dnaRandom.pick(['restrained', 'standard', 'dramatic']),
        },
        imagery: {
          style: dnaRandom.pick([
            'documentary',
            'studio',
            'high-fashion',
            'fashion-editorial',
            'warm-lifestyle',
            'product-focused',
            'illustration-led',
          ]),
          dominance: dnaRandom.pick(['low', 'medium', 'high']),
          treatment: dnaRandom.pick(['natural', 'duotone', 'high-contrast', 'soft-grain']),
        },
        navigation: dnaRandom.pick([
          'transparent-overlay',
          'centered-logo',
          'split-nav',
          'compact-sticky',
          'utility-plus-primary',
        ]),
        motion: dnaRandom.pick(['none', 'subtle', 'expressive']),
        corners: dnaRandom.pick(['sharp', 'soft', 'pill', 'framed', 'borderless']),
        ctaStyle: dnaRandom.pick(['solid', 'outline', 'text-link', 'floating-booking', 'sticky-mobile']),
        colorBehavior: dnaRandom.pick(['monochrome', 'high-contrast', 'tonal', 'accent-led', 'editorial-neutrals']),
      }
      const rationale = `${direction} suits a ${analysis.industry} business aiming to ${
        analysis.goals[0]?.toLowerCase() ?? 'win enquiries'
      }.`

      const baseTokens: DesignTokens = {
        ...defaultTokens,
        typography: {
          headingFamily: headingFamilies[(dnaRandom.next() * headingFamilies.length) | 0] ?? headingFamilies[0]!,
          bodyFamily: bodyFamilies[(dnaRandom.next() * bodyFamilies.length) | 0] ?? bodyFamilies[0]!,
          baseSize: dnaRandom.pick([16, 17, 18]),
          scaleRatio: dnaRandom.pick([1.2, 1.25, 1.333]),
        },
        radius: dna.corners === 'pill' ? 'full' : dna.corners === 'soft' ? 'md' : 'none',
        spacing:
          dna.composition.density === 'dense' ? 'tight' : dna.composition.density === 'airy' ? 'roomy' : 'normal',
        maxWidth: dnaRandom.pick([1160, 1240, 1320]),
      }

      const hue = Math.floor(dnaRandom.next() * 360)
      const themed: DesignTokens =
        brief.logoColors.length > 0
          ? paletteFromLogoColors(brief.logoColors, baseTokens)
          : {
              ...baseTokens,
              palette: this.paletteForBehavior(dna.colorBehavior, hue),
            }

      return {
        id: `direction-${index + 1}`,
        name: direction.replace(/-/g, ' '),
        rationale,
        dna,
        tokens: themed,
      }
    })

    return this.usage('design_dna', { options })
  }

  private paletteForBehavior(behavior: DesignDna['colorBehavior'], hue: number): DesignTokens['palette'] {
    if (behavior === 'monochrome') {
      const background = hslToHex({ h: hue, s: 16, l: 10 })
      return {
        background,
        surface: hslToHex({ h: hue, s: 14, l: 16 }),
        foreground: '#f6f4f1',
        muted: '#b4aea7',
        primary: '#f6f4f1',
        primaryForeground: background,
        accent: hslToHex({ h: (hue + 28) % 360, s: 62, l: 58 }),
        border: hslToHex({ h: hue, s: 12, l: 24 }),
      }
    }

    if (behavior === 'high-contrast') {
      return {
        background: '#ffffff',
        surface: '#f1f1f1',
        foreground: '#000000',
        muted: '#4a4a4a',
        primary: '#000000',
        primaryForeground: '#ffffff',
        accent: hslToHex({ h: hue, s: 88, l: 48 }),
        border: '#d6d6d6',
      }
    }

    const primary = hslToHex({ h: hue, s: behavior === 'accent-led' ? 58 : 24, l: behavior === 'accent-led' ? 40 : 18 })

    return {
      background: hslToHex({ h: hue, s: 18, l: 97 }),
      surface: hslToHex({ h: hue, s: 20, l: 93 }),
      foreground: hslToHex({ h: hue, s: 18, l: 12 }),
      muted: hslToHex({ h: hue, s: 10, l: 44 }),
      primary,
      primaryForeground: readableForeground(primary),
      accent: hslToHex({ h: (hue + 42) % 360, s: 54, l: 52 }),
      border: hslToHex({ h: hue, s: 14, l: 86 }),
    }
  }

  async planSite(
    brief: GenerationBrief,
    analysis: BriefAnalysis,
    dna: DesignDna,
  ): Promise<AiResult<SitePlan>> {
    const random = this.seedFor(brief, 'plan')
    const pages: SitePlan['pages'] = [
      {
        path: '/',
        title: 'Home',
        purpose: 'Introduce the business and drive enquiries.',
        inMainNav: true,
        sectionPlan: [
          { family: 'HERO', intent: 'Lead with the core promise' },
          { family: 'SERVICES', intent: 'Summarise the main services' },
          { family: 'ABOUT', intent: 'Establish credibility' },
          ...(brief.uploadedImageUrls.length > 0 || dna.imagery.style !== 'illustration-led'
            ? [{ family: 'GALLERY', intent: 'Show real work' }]
            : []),
          ...(brief.testimonials.length > 0 ? [{ family: 'REVIEWS', intent: 'Social proof' }] : []),
          { family: 'CTA', intent: 'Close with the primary action' },
        ],
      },
      {
        path: '/services',
        title: 'Services',
        purpose: 'Detail every service offered.',
        inMainNav: true,
        sectionPlan: [
          { family: 'HERO', intent: 'Page introduction' },
          { family: 'SERVICES', intent: 'Full service detail' },
          { family: 'FAQ', intent: 'Answer common questions' },
          { family: 'CTA', intent: 'Book or enquire' },
        ],
      },
      {
        path: '/about',
        title: 'About',
        purpose: 'Tell the story behind the business.',
        inMainNav: true,
        sectionPlan: [
          { family: 'HERO', intent: 'Page introduction' },
          { family: 'ABOUT', intent: 'The story' },
          { family: 'CTA', intent: 'Invite contact' },
        ],
      },
      {
        path: '/contact',
        title: 'Contact',
        purpose: 'Capture enquiries and show location details.',
        inMainNav: true,
        sectionPlan: [
          { family: 'HERO', intent: 'Page introduction' },
          { family: 'CONTACT', intent: 'Details plus enquiry form' },
        ],
      },
    ]

    if (analysis.services.length > 4 && random.bool(0.5)) {
      pages.splice(2, 0, {
        path: '/gallery',
        title: 'Gallery',
        purpose: 'Showcase completed work.',
        inMainNav: true,
        sectionPlan: [
          { family: 'HERO', intent: 'Page introduction' },
          { family: 'GALLERY', intent: 'Portfolio grid' },
          { family: 'CTA', intent: 'Invite contact' },
        ],
      })
    }

    const home = pages[0]!
    home.sectionPlan = brief.homepageLength === 'expanded'
      ? [{ family: 'HERO', intent: 'Introduce the business' }, { family: 'SERVICES', intent: 'Explore services' }, { family: 'ABOUT', intent: 'Explain our approach' }, { family: brief.testimonials.length ? 'REVIEWS' : 'FAQ', intent: 'Help visitors decide' }, { family: 'CONTACT', intent: 'Get in touch' }, { family: 'CTA', intent: 'Invite enquiries' }]
      : [{ family: 'HERO', intent: 'Introduce the business' }, { family: 'SERVICES', intent: 'Explore services' }, ...(brief.testimonials.length ? [{ family: 'REVIEWS', intent: 'Real customer feedback' }] : []), { family: 'CTA', intent: 'Invite enquiries' }]
    for (const [index, service] of brief.services.entries()) {
      pages.push({ path: `/services/service-${index + 1}`, title: service, serviceName: service, purpose: `Explain ${service} and invite enquiries.`, inMainNav: false, sectionPlan: [{ family: 'HERO', intent: service }, { family: 'ABOUT', intent: `Explain ${service}` }, { family: 'CTA', intent: 'Enquire' }] })
    }
    for (const page of pages) if (page.serviceName && !page.sectionPlan.some((section) => section.family === 'FAQ')) page.sectionPlan.splice(page.sectionPlan.length - 1, 0, { family: 'FAQ', intent: `Answer questions about ${page.serviceName}` })
    const navigation = pages.filter((page) => page.inMainNav).map((page) => ({ label: page.title, path: page.path, children: page.path === '/services' ? pages.filter((child) => child.serviceName).map((child) => ({ label: child.title, path: child.path })) : [] }))
    return this.usage('sitemap_plan', { pages, navigation })
  }

  async writePage(
    brief: GenerationBrief,
    analysis: BriefAnalysis,
    dna: DesignDna,
    tokens: DesignTokens,
    page: SitePlan['pages'][number],
  ): Promise<AiResult<PageContent>> {
    const random = this.seedFor(brief, `page:${page.path}`)
    const services =
      analysis.services.length > 0 ? analysis.services : ['Consultation', 'Delivery', 'Aftercare']
    const location = analysis.locations[0]
    const isHome = page.path === '/'
    const h1 = isHome
      ? `${brief.businessName}${location ? ` · ${location}` : ''}`
      : `${page.title}${location ? ` in ${location}` : ''}`

    const sections: WebsiteSection[] = page.sectionPlan.map((planned, index) => {
      const componentId = this.chooseComponent(planned.family, dna, random, brief, isHome && index === 0)

      return {
        id: `${page.path.replace(/\W+/g, '') || 'home'}-${index}-${componentId}`,
        componentId,
        componentVersion: '1.0.0',
        hidden: false,
        props: this.buildProps(componentId, {
          brief,
          analysis,
          page,
          services,
          location,
          h1,
          dna,
          tokens,
        }),
      }
    })

    if(brief.templateId){
      sections.splice(0,sections.length,...templateGenerationComponents(brief.templateId,page.path,brief.testimonials.length>0).map((componentId,index)=>{
        const props=initialTemplateProps(componentId)
        for(const field of templateCopyCatalogue([componentId])[0]!.fields){const key=field.path.slice(1);props[key]=field.headingLevel===1?h1:field.headingLevel?index===0?page.title:brief.services[index%Math.max(1,brief.services.length)]||brief.businessName:field.type==='textarea'?brief.description:''}
        setTemplateHeading(componentId,props,h1)
        return {id:`layout-${index}`,componentId,componentVersion:'1.0.0',hidden:false,props}
      }))
    }

    return this.usage('website_copy', {
      path: page.path,
      h1,
      seo: {
        title: `${page.title} | ${brief.businessName}`.slice(0, 60),
        description: `${page.purpose} ${brief.businessName}${location ? ` serves ${location}` : ''}.`.slice(0, 155),
        index: true,
      },
      sections,
    })
  }

  private chooseComponent(
    family: string,
    dna: DesignDna,
    random: SeededRandom,
    brief: GenerationBrief,
    isPrimaryHero: boolean,
  ): string {
    const candidates = listComponents(family as never).filter(definition=>!definition.componentId.startsWith('Tpl_')).map((definition) => definition.componentId)

    if (candidates.length === 0) {
      return 'HeroTypographic'
    }

    if (family === 'HERO') {
      const hasImagery = brief.uploadedImageUrls.length > 0
      if (!hasImagery && dna.imagery.dominance === 'low') return 'HeroTypographic'
      if (isPrimaryHero && dna.ctaStyle === 'floating-booking') return 'HeroSplitBooking'
      return random.pick(candidates)
    }

    return random.pick(candidates)
  }

  private buildProps(
    componentId: string,
    ctx: {
      brief: GenerationBrief
      analysis: BriefAnalysis
      page: SitePlan['pages'][number]
      services: string[]
      location?: string
      h1: string
      dna: DesignDna
      tokens: DesignTokens
    },
  ): Record<string, unknown> {
    const { brief, analysis, page, services, location, h1 } = ctx
    const image = (index: number) => brief.uploadedImageUrls[index % Math.max(brief.uploadedImageUrls.length, 1)]
    const navItems = [
      { label: 'Services', href: '/services' },
      { label: 'About', href: '/about' },
      { label: 'Contact', href: '/contact' },
    ]

    switch (componentId) {
      case 'HeaderTransparent':
      case 'HeaderSplitUtility':
        return {
          logoText: brief.businessName,
          items: navItems,
          cta: { label: 'Get in touch', href: '/contact' },
          sticky: true,
        }

      case 'HeroEditorial':
      case 'HeroTypographic':
      case 'HeroSplitBooking': {
        const base = {
          eyebrow: location ?? analysis.industry,
          heading: h1,
          body: brief.description.slice(0, 220),
          primaryCta: { label: 'Get in touch', href: '/contact' },
          imageUrl: image(0),
          imageAlt: `${brief.businessName} work sample`,
        }

        if (componentId === 'HeroSplitBooking') {
          return { ...base, panelTitle: 'Enquire', panelLines: location ? [location] : [] }
        }

        if (componentId === 'HeroTypographic') {
          return { ...base, keywords: services.slice(0, 4) }
        }

        return base
      }

      case 'ServicesLargeNumbers':
      case 'ServicesImageRail':
      case 'ServicesAlternatingShowcase':
        return {
          heading: page.path === '/services' ? 'What we do' : 'Services',
          intro: `How ${brief.businessName} can help.`,
          items: services.slice(0, 6).map((service, index) => ({
            title: service,
            description: `${service} delivered by the ${brief.businessName} team.`,
            imageUrl: image(index + 1),
            imageAlt: service,
          })),
          cta: { label: 'See all services', href: '/services' },
        }

      case 'AboutSplitOverlap':
        return {
          eyebrow: 'About',
          heading: `Why clients choose ${brief.businessName}`,
          body: brief.description,
          imageUrl: image(2),
          imageAlt: `${brief.businessName} team`,
          stats: [],
        }

      case 'GalleryAsymmetric':
        return {
          heading: 'Selected work',
          images:
            brief.uploadedImageUrls.length > 0
              ? brief.uploadedImageUrls.slice(0, 6).map((url) => ({ url, alt: `${brief.businessName} work` }))
              : Array.from({ length: 4 }, () => ({ alt: `${brief.businessName} work` })),
        }

      case 'ReviewsEditorialQuote':
      case 'ReviewsTrustStrip':
        return {
          heading: 'What clients say',
          testimonials: brief.testimonials,
        }

      case 'FaqAccordion':
        return {
          heading: 'Frequently asked',
          items: [
            {
              question: 'How do I book?',
              answer: 'Send an enquiry through the contact form and the team will reply.',
            },
          ],
        }

      case 'ContactSplit':
        return {
          heading: 'Get in touch',
          intro: `Tell ${brief.businessName} what you need.`,
          address: location,
          hours: [],
          formFields: [
            { name: 'name', label: 'Name', type: 'text' },
            { name: 'email', label: 'Email', type: 'email' },
            { name: 'message', label: 'Message', type: 'textarea' },
          ],
          submitLabel: 'Send enquiry',
        }

      case 'CtaCinematic':
        return {
          heading: `Work with ${brief.businessName}`,
          body: analysis.goals[0],
          primaryCta: { label: 'Start an enquiry', href: '/contact' },
          backgroundImageUrl: image(3),
          backgroundAlt: '',
        }

      case 'FooterEditorial':
      case 'FooterCompact':
        return {
          businessName: brief.businessName,
          tagline: brief.description.slice(0, 90),
          columns: [{ title: 'Pages', items: navItems }],
          socials: [],
          legalLinks: [],
          address: location,
        }

      default:
        return {}
    }
  }

  async planImages(
    brief: GenerationBrief,
    _model: WebsiteModel,
    slots: ImageSlotRequest[],
  ): Promise<AiResult<ImagePlan>> {
    const images: ImagePlan['images'] = slots.map((slot) => ({
      slot: slot.slot,
      prompt: `Editorial photograph for ${brief.businessName}, ${brief.industry ?? 'business'}, ${
        slot.heading ?? slot.pageTitle
      }, natural light, no text, no logos`,
      alt: `${brief.businessName} — ${slot.heading ?? slot.pageTitle}`,
      aspectRatio: slot.family === 'HERO' ? '16:10' : '4:5',
    }))

    return this.usage('image_plan', { images })
  }

  async generateImage(
    prompt: string,
    aspectRatio: string,
    slot: string,
    alt: string,
  ): Promise<AiResult<GeneratedImage>> {
    if (slot === 'brand:logo') {
      const name = escapeXml(alt)
      const width = Math.max(320, Array.from(alt).length * 30 + 80)
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="120" viewBox="0 0 ${width} 120" role="img" aria-label="${name}"><rect width="100%" height="100%" rx="16" fill="white"/><text x="50%" y="62" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-size="44" font-weight="700" fill="#171717">${name}</text></svg>`
      return this.usage('image_generate', { slot, alt, prompt, data: Buffer.from(svg), contentType: 'image/svg+xml' })
    }
    const random = new SeededRandom(prompt)
    const hue = Math.floor(random.next() * 360)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000" role="img" aria-label="${escapeXml(alt)}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="hsl(${hue} 42% 72%)"/>
    <stop offset="100%" stop-color="hsl(${(hue + 40) % 360} 38% 34%)"/>
  </linearGradient></defs>
  <rect width="1600" height="1000" fill="url(#g)"/>
</svg>`

    return this.usage('image_generate', {
      slot,
      alt,
      prompt,
      data: Buffer.from(svg, 'utf8'),
      contentType: 'image/svg+xml',
    })
  }

  async reviewSite(model: WebsiteModel): Promise<AiResult<ReviewReport>> {
    const issues: ReviewReport['issues'] = []

    for (const page of model.pages) {
      if (!page.sections.some((section) => section.componentId.startsWith('Cta'))) {
        issues.push({
          level: 'info',
          area: 'design',
          message: 'Page has no closing call to action.',
          pagePath: page.path,
        })
      }
    }

    return this.usage('final_review', {
      issues,
      summary: `Reviewed ${model.pages.length} pages with the stub provider.`,
    })
  }

  async patchSection(
    instruction: string,
    model: WebsiteModel,
    target: { pageId: string; sectionId: string },
  ): Promise<AiResult<AiPatch>> {
    const page = model.pages.find((candidate) => candidate.id === target.pageId)
    const section = page?.sections.find((candidate) => candidate.id === target.sectionId)
    const currentHeading = (section?.props as { heading?: string } | undefined)?.heading ?? ''

    return this.usage('editor_command', {
      target: { pageId: target.pageId, sectionId: target.sectionId, scope: 'section' as const },
      operations: [
        {
          op: 'replace' as const,
          path: '/heading',
          value: currentHeading ? `${currentHeading} — ${instruction}`.slice(0, 80) : instruction.slice(0, 80),
        },
      ],
      reason: `Stub rewrite for: ${instruction}`,
      requiresReview: true,
    })
  }
}

/// SVG is XML: an unescaped business name ("Flour & Ember") breaks the
/// document and the browser refuses to render the placeholder.
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
