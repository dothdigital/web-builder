import { useId, type CSSProperties, type ReactNode, type HTMLAttributes } from 'react'

/** Distribute cards evenly between rows instead of leaving a single orphan. */
export function balancedRows(count: number, maxColumns: number): number[] {
  if (count <= 0) return []
  const rows = Math.ceil(count / maxColumns)
  const size = Math.floor(count / rows)
  return Array.from({ length: rows }, (_, index) => size + (index < count % rows ? 1 : 0))
}

type BalancedGridProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode; count: number; minimumWidth?: number; gap?: string; style?: CSSProperties; as?: 'div' | 'ol'; maxColumns?: 1 | 3; enabled?: boolean
  variants?: { ancestor: string; childSelector: string; count: number }[]
  scope?: string
}

export function BalancedGrid({ scope, ...props }: BalancedGridProps) {
  if (props.enabled === false) return <Grid {...props} id="" />
  // Static exports have no React hook dispatcher. Their section scope supplies
  // a stable, unique CSS identifier without calling useId in another renderer.
  if (scope !== undefined) return <Grid {...props} id={`awb-grid-${Array.from(scope).map(char => char.codePointAt(0)!.toString(16)).join('-')}`} />
  return <InteractiveGrid {...props} />
}

function InteractiveGrid(props: Omit<BalancedGridProps, 'scope'>) {
  const id = `awb-grid-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  return <Grid {...props} id={id} />
}

function Grid({ children, count, minimumWidth = 260, gap = '1.5rem', style, as: Tag = 'div', maxColumns = 3, enabled = true, variants = [], id, ...attributes }: Omit<BalancedGridProps, 'scope'> & { id: string }) {
  function rowRules(columns: number, total = count, ancestor = '', childSelector = '') {
    let index = 0
    return balancedRows(total, columns).flatMap(size => Array.from({ length: size }, () =>
      `${ancestor} #${id}>:nth-child(${++index}${childSelector ? ` of ${childSelector}` : ''}){grid-column:span ${6 / size}}`
    )).join('')
  }
  function rules(columns: number) {
    return rowRules(columns) + variants.map(variant => rowRules(columns, variant.count, variant.ancestor, variant.childSelector)).join('')
  }
  if (!enabled) return <Tag {...attributes} style={style}>{children}</Tag>
  return <div style={{ containerType: 'inline-size', minWidth: 0 }}>
    <style>{`#${id}>*{min-width:0;grid-column:span 6}${rules(1)}${maxColumns > 1 ? `@container(min-width:calc(${minimumWidth * 2}px + ${gap})){${rules(2)}}@container(min-width:calc(${minimumWidth * 3}px + ${gap} + ${gap})){${rules(3)}}` : ''}`}</style>
    <Tag {...attributes} id={id} style={{ ...style, display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap }}>{children}</Tag>
  </div>
}
