import { useId, type ReactNode } from 'react'
import { z } from 'zod'

export const removedElementsSchema = z.array(z.string().regex(/^\/[a-zA-Z0-9_/-]+$/)).default([])

// Preserve required content fields for schema validation and reversible edits.
// Scope removal to this component instance in editor, preview and exported HTML.
type RemovalProps = { paths: string[]; children: ReactNode; scope?: string }

export function RemovedElements({ paths, children, scope }: RemovalProps) {
  if (!paths.length) return <>{children}</>
  if (scope !== undefined) return <ScopedRemoval paths={paths} id={`awb-static-${Array.from(scope).map((char) => char.codePointAt(0)!.toString(16)).join('-')}`}>{children}</ScopedRemoval>
  return <InteractiveRemoval paths={paths}>{children}</InteractiveRemoval>
}

function InteractiveRemoval({ paths, children }: RemovalProps) {
  const id = `awb-elements-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  return <ScopedRemoval paths={paths} id={id}>{children}</ScopedRemoval>
}

function ScopedRemoval({ paths, children, id }: RemovalProps & { id: string }) {
  const rules = paths.map((path) => `#${id} [data-awb-element="${path}"]{display:none!important}`).join('')
  return <div id={id} style={{ display: 'contents' }}><style>{rules}</style>{children}</div>
}
