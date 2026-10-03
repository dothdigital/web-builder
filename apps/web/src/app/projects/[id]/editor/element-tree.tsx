'use client'
import type { ElementNode } from '@/lib/element-tree'
export function ElementTree({ nodes, selected, onSelect, onDuplicate, canDuplicate }: { onDuplicate?: (path: string) => void; canDuplicate?: (path: string) => boolean; nodes: ElementNode[]; selected?: string; onSelect: (path: string) => void }) {
  return <ul className="ml-3 grid gap-0.5 border-l border-neutral-200 pl-2">
    {nodes.map((node) => <li key={node.path}>
      <div className="flex min-w-0 items-center"><button type="button" aria-pressed={selected === node.path} title={node.label} className={`min-w-0 flex-1 truncate rounded px-2 py-1.5 text-left text-xs ${selected === node.path ? 'bg-sky-100 font-medium text-sky-800' : 'text-neutral-600 hover:bg-neutral-100'}`} onClick={() => onSelect(node.path)}>{node.children.length ? '▾ ' : '· '}{node.label}</button>{onDuplicate && canDuplicate?.(node.path) && <button type="button" title={`Duplicate ${node.label}`} aria-label={`Duplicate ${node.label}`} className="shrink-0 rounded p-1.5 text-sky-700 hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-sky-600" onClick={() => onDuplicate(node.path)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></svg></button>}</div>
      {node.children.length > 0 && <ElementTree nodes={node.children} selected={selected} onSelect={onSelect} onDuplicate={onDuplicate} canDuplicate={canDuplicate} />}
    </li>)}
  </ul>
}
