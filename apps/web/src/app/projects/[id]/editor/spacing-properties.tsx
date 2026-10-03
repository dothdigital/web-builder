'use client'

import { useEffect, useState } from 'react'
import { objectScope } from '@/lib/object-editing'
import { SpacingControls } from './spacing-controls'

export function SpacingProperties({ paths, props, prefix = '', onChange }: { paths: string[]; props: Record<string, unknown>; prefix?: string; onChange: (patch: Record<string, unknown>) => void }) {
  const [elements, setElements] = useState<(HTMLElement | null)[]>([])
  const pathKey = JSON.stringify(paths)
  useEffect(() => {
    const frame = document.querySelector('[data-awb-selected-frame="true"]')
    const all = Array.from(frame?.querySelectorAll<HTMLElement>('[data-awb-element]') ?? [])
    const raf = requestAnimationFrame(() => setElements((JSON.parse(pathKey) as string[]).map(path => all.find(element => element.dataset.awbElement === `${prefix}${path}`) ?? null)))
    return () => cancelAnimationFrame(raf)
  }, [pathKey, prefix, props])
  const appearances = paths.map(path => {
    const scope = objectScope(props, path)
    return (scope.props.elementColors as Record<string, Record<string, unknown>> | undefined)?.[scope.path] ?? {}
  })
  return <fieldset className="m-4 rounded-lg border border-neutral-200 p-3 text-xs">
    <legend className="px-1 text-sm font-semibold">Spacing{paths.length > 1 ? ` · ${paths.length} objects` : ''}</legend>
    <SpacingControls elements={paths.map((_, index) => elements[index] ?? null)} appearances={appearances} onChange={onChange} />
  </fieldset>
}
