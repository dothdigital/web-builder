// Keep progress metadata alongside a separately saved return value: several
// stages return a model or version ID rather than their public progress output.
export function stageCheckpoint(output: unknown, result: unknown) {
  return { ...(output && typeof output === 'object' && !Array.isArray(output) ? output : {}), checkpoint: { version: 1, result } }
}

export function stageCheckpointResult(output: unknown, stage?: string): { result: unknown } | undefined {
  if (!output || typeof output !== 'object') return undefined
  const saved = (output as { checkpoint?: { version?: number; result?: unknown } }).checkpoint
  if (saved?.version === 1 && Object.prototype.hasOwnProperty.call(saved, 'result')) return { result: saved.result }
  // Older builds already saved most completed results, before the explicit
  // checkpoint wrapper existed. Never treat progress counters as a result.
  const data = output as Record<string, unknown>
  if (stage === 'ANALYZE_BRIEF' && Array.isArray(data.missingFacts)) return { result: data }
  if (stage === 'NEXT_QUESTIONS' && Array.isArray(data.questions)) return { result: data }
  if (stage === 'DESIGN_DIRECTIONS' && Array.isArray(data.options)) return { result: data }
  if (stage === 'DESIGN_DNA' && data.dna && data.tokens) return { result: { dna: data.dna, tokens: data.tokens } }
  if (stage === 'SITE_PLAN' && Array.isArray(data.pages) && data.navigation) return { result: data }
  if (stage === 'CONTENT' && !data.scope && Array.isArray(data.pages)) return { result: data.pages }
  if (['COMPOSE', 'IMAGES'].includes(stage ?? '') && data.model) return { result: data.model }
  return undefined
}
