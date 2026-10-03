import type { WebsiteModel } from './model'

export interface DesignFingerprint {
  heroComponentId: string
  navigation: string
  sectionSequence: string[]
  componentSet: string[]
  typography: string
  imageryDominance: string
  density: string
  symmetry: string
}

/// Deterministic composition fingerprint used for the uniqueness check (SOW 8.2).
export function buildFingerprint(model: WebsiteModel): DesignFingerprint {
  const home = model.pages.find((page) => page.path === '/') ?? model.pages[0]
  const sequence = home.sections.map((section) => section.componentId)
  const componentSet = [
    ...new Set(model.pages.flatMap((page) => page.sections.map((section) => section.componentId))),
  ].sort()

  return {
    heroComponentId: sequence[0] ?? 'none',
    navigation: model.designDna.navigation,
    sectionSequence: sequence,
    componentSet,
    typography: model.designDna.typography.headingStyle,
    imageryDominance: model.designDna.imagery.dominance,
    density: model.designDna.composition.density,
    symmetry: model.designDna.composition.symmetry,
  }
}

/// 0 = completely different, 1 = identical. Compared against a configurable
/// ceiling; above it the composer must re-compose rather than recolour.
export function fingerprintSimilarity(a: DesignFingerprint, b: DesignFingerprint): number {
  const scores: Array<[number, number]> = [
    [3, a.heroComponentId === b.heroComponentId ? 1 : 0],
    [2, a.navigation === b.navigation ? 1 : 0],
    [4, sequenceSimilarity(a.sectionSequence, b.sectionSequence)],
    [3, jaccard(a.componentSet, b.componentSet)],
    [1, a.typography === b.typography ? 1 : 0],
    [1, a.imageryDominance === b.imageryDominance ? 1 : 0],
    [1, a.density === b.density ? 1 : 0],
    [1, a.symmetry === b.symmetry ? 1 : 0],
  ]

  const weight = scores.reduce((total, [w]) => total + w, 0)
  const score = scores.reduce((total, [w, s]) => total + w * s, 0)

  return Number((score / weight).toFixed(4))
}

export const DEFAULT_SIMILARITY_CEILING = 0.6

function jaccard(a: string[], b: string[]): number {
  const setA = new Set(a)
  const setB = new Set(b)
  const intersection = [...setA].filter((value) => setB.has(value)).length
  const union = new Set([...setA, ...setB]).size

  return union === 0 ? 0 : intersection / union
}

/// Bigram overlap: rewards a genuinely different section order, not just a
/// different set of components.
function sequenceSimilarity(a: string[], b: string[]): number {
  const bigrams = (list: string[]) => list.slice(0, -1).map((value, index) => `${value}>${list[index + 1]}`)
  const bigramsA = bigrams(a)
  const bigramsB = bigrams(b)

  if (bigramsA.length === 0 && bigramsB.length === 0) {
    return a[0] === b[0] ? 1 : 0
  }

  return jaccard(bigramsA, bigramsB)
}
