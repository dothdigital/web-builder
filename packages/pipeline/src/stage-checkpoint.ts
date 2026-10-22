// Keep progress metadata alongside a separately saved return value: several
// stages return a model or version ID rather than their public progress output.
export function stageCheckpoint(output: unknown, result: unknown) {
  return { ...(output && typeof output === 'object' && !Array.isArray(output) ? output : {}), checkpoint: { version: 1, result } }
}

export function stageCheckpointResult(output: unknown): { result: unknown } | undefined {
  if (!output || typeof output !== 'object') return undefined
  const saved = (output as { checkpoint?: { version?: number; result?: unknown } }).checkpoint
  return saved?.version === 1 && Object.prototype.hasOwnProperty.call(saved, 'result') ? { result: saved.result } : undefined
}
