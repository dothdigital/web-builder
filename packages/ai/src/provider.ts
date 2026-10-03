import type { AiPatch, DesignDna, DesignTokens, WebsiteModel } from '@awb/website-model'
import type {
  BriefAnalysis,
  DesignDirections,
  FollowUpQuestions,
  ImagePlan,
  PageContent,
  ReviewReport,
  SitePlan,
} from './contracts'
import type { AiTask } from './models'
import type { DesignReference, ReferenceObservation } from '@awb/shared/design-reference'

export interface GenerationBrief {
  designReference?: DesignReference & { observation?: ReferenceObservation }
  homepageLength?: 'compact' | 'expanded'
  homepageSections?: string[]
  businessName: string
  description: string
  industry?: string
  location?: string
  services: string[]
  goals: string[]
  tonePreferences: string[]
  answers: Record<string, string>
  hasLogo: boolean
  logoColors: string[]
  /// URLs of images the user uploaded; empty means AI must generate imagery.
  uploadedImageUrls: string[]
  testimonials: Array<{ quote: string; author: string; source?: string }>
}

export interface ImageSlotRequest {
  /// `pageId:sectionId:/jsonPointer` identifying the prop that needs artwork.
  slot: string
  pageTitle: string
  componentId: string
  family: string
  heading?: string
  subjectContext?: string
}

export interface AiUsage {
  task: AiTask
  model: string
  inputTokens: number
  outputTokens: number
  costCents: number
}

export interface AiResult<T> {
  data: T
  usage: AiUsage
}

export interface GeneratedImage {
  slot: string
  alt: string
  prompt: string
  /// Raw bytes for the asset pipeline to upload; stub providers return SVG.
  data: Buffer
  contentType: string
}

export interface AiProvider {
  readonly name: string
  analyzeBrief(brief: GenerationBrief): Promise<AiResult<BriefAnalysis>>
  proposeQuestions(brief: GenerationBrief, analysis: BriefAnalysis): Promise<AiResult<FollowUpQuestions>>
  proposeDesignDirections(
    brief: GenerationBrief,
    analysis: BriefAnalysis,
  ): Promise<AiResult<DesignDirections>>
  planSite(brief: GenerationBrief, analysis: BriefAnalysis, dna: DesignDna): Promise<AiResult<SitePlan>>
  writePage(
    brief: GenerationBrief,
    analysis: BriefAnalysis,
    dna: DesignDna,
    tokens: DesignTokens,
    page: SitePlan['pages'][number],
  ): Promise<AiResult<PageContent>>
  planImages(
    brief: GenerationBrief,
    model: WebsiteModel,
    slots: ImageSlotRequest[],
  ): Promise<AiResult<ImagePlan>>
  generateImage(prompt: string, aspectRatio: string, slot: string, alt: string): Promise<AiResult<GeneratedImage>>
  reviewSite(model: WebsiteModel): Promise<AiResult<ReviewReport>>
  patchSection(instruction: string, model: WebsiteModel, target: { pageId: string; sectionId: string }): Promise<AiResult<AiPatch>>
}

export interface AiProviderConfig {
  apiKey?: string
  modelOverrides?: Partial<Record<AiTask, { model: string; fallbacks: string[] }>>
  /// Deterministic seed used by the stub provider so local runs are repeatable.
  seed?: string
}
