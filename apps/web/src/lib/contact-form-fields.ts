export function updateContactFormFields(props: Record<string, unknown>, value: unknown): Record<string, unknown> {
  const previous = (Array.isArray(props.formFields) ? props.formFields : []) as Array<{ name: string; rows?: number }>
  const fields = (Array.isArray(value) ? value : []) as Array<{ name: string; rows?: number }>
  const colors = (props.elementColors ?? {}) as Record<string, Record<string, unknown>>
  const elementColors: Record<string, Record<string, unknown>> = {}
  for (const [path, appearance] of Object.entries(colors)) {
    const match = path.match(/^\/formFields\/(\d+)(\/.*)$/)
    if (!match) { elementColors[path] = appearance; continue }
    const oldField = previous[Number(match[1])]
    const index = fields.findIndex(field => field.name === oldField?.name)
    if (index === -1) continue
    const next = { ...appearance }
    // Row count takes over from a manually dragged height.
    if (match[2] === '/input' && fields[index]!.rows !== oldField?.rows) delete next.height
    elementColors[`/formFields/${index}${match[2]}`] = next
  }
  return { ...props, formFields: value, elementColors }
}
