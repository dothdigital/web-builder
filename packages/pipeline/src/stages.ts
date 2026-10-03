import { GenerationStage } from '@awb/database'

export interface StageDescriptor {
  stage: GenerationStage
  label: string
  /// Copy shown to the user while the stage runs.
  activity: string
  /// Relative cost, used to turn completed stages into a percentage.
  weight: number
}

export const generationStages: StageDescriptor[] = [
  { stage: GenerationStage.ANALYZE_BRIEF, label: 'Understanding your business', activity: 'Reading your brief and working out what is missing', weight: 1 },
  { stage: GenerationStage.NEXT_QUESTIONS, label: 'Checking for gaps', activity: 'Deciding whether anything still needs to be asked', weight: 1 },
  { stage: GenerationStage.DESIGN_DIRECTIONS, label: 'Exploring art directions', activity: 'Sketching distinct visual directions for your brand', weight: 2 },
  { stage: GenerationStage.DESIGN_DNA, label: 'Locking the Design DNA', activity: 'Fixing layout rhythm, type and colour tokens', weight: 1 },
  { stage: GenerationStage.SITE_PLAN, label: 'Planning the site', activity: 'Choosing pages, navigation and section order', weight: 1 },
  { stage: GenerationStage.CONTENT, label: 'Writing your content', activity: 'Drafting headings, copy and SEO metadata per page', weight: 3 },
  { stage: GenerationStage.COMPOSE, label: 'Composing the pages', activity: 'Binding copy to layout components and checking uniqueness', weight: 2 },
  { stage: GenerationStage.IMAGES, label: 'Preparing imagery', activity: 'Adding your logo, placing uploads and generating missing imagery', weight: 3 },
  { stage: GenerationStage.VALIDATE, label: 'Final review', activity: 'Validating structure, SEO and accessibility', weight: 1 },
]

export const totalStageWeight = generationStages.reduce((total, descriptor) => total + descriptor.weight, 0)

export function stageDescriptor(stage: GenerationStage): StageDescriptor | undefined {
  return generationStages.find((descriptor) => descriptor.stage === stage)
}
