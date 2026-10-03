/** Resolve a visible selection even when the property itself has no DOM node. */
export function outlinePath(componentId: string, selected: string, rendered: string[]): string | undefined {
  // Outline the actual rendered text/image, including any saved movement.
  if (rendered.includes(selected)) return selected
  // Non-rendered properties (such as embed code) fall back to their object.
  const manualObject = componentId === 'ManualSection' ? selected.match(/^\/items\/\d+(?=\/|$)/)?.[0] : undefined
  if (manualObject && rendered.includes(manualObject)) return manualObject
  return rendered.filter(path => selected.startsWith(`${path}/`)).sort((a, b) => b.length - a.length)[0]
}
