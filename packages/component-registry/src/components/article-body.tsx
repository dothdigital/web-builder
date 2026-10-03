import React, { type CSSProperties } from 'react'

type Block = { type: 'paragraph' | 'ul' | 'ol'; lines: string[]; start?: number }
export function parseArticleBody(text: string): Block[] {
  const blocks: Block[] = []
  let current: Block | undefined
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (!line.trim()) { current = undefined; continue }
    const bullet = line.match(/^\s*[-*•]\s+(.+)$/)
    const number = line.match(/^\s*(\d+)[.)]\s+(.+)$/)
    const type = bullet ? 'ul' : number ? 'ol' : 'paragraph'
    if (!current || current.type !== type) {
      current = { type, lines: [], ...(number ? { start: Number(number[1]) } : {}) }; blocks.push(current)
    }
    current.lines.push(bullet?.[1] ?? number?.[2] ?? line)
  }
  return blocks
}
export function ArticleBody({ text, path, style, 'data-awb-element': elementPath = path }: { text: string; path: string; style?: CSSProperties; 'data-awb-element'?: string }) {
  const blocks = parseArticleBody(text)
  return <div data-awb-inline-text="true" data-awb-element={elementPath} style={{ maxWidth: '62ch', lineHeight: 1.65, color: 'var(--awb-muted)', ...style }}>
    {blocks.map((block, index) => {
      // Keep spacing between blocks, never after the final block. Inline editing
      // replaces these children with plain text, which has no trailing margin.
      const margin = index === blocks.length - 1 ? 0 : '0 0 1em'
      if (block.type === 'paragraph') return <p key={index} style={{ whiteSpace: 'pre-line', margin }}>{block.lines.join('\n')}</p>
      const items = block.lines.map((line, i) => <li key={i} style={{ marginBottom: i === block.lines.length - 1 ? 0 : '0.4em' }}>{line}</li>)
      const listStyle: CSSProperties = { paddingLeft: '1.5em', margin, listStylePosition: 'outside', listStyleType: block.type === 'ul' ? 'disc' : 'decimal' }
      return block.type === 'ul' ? <ul key={index} style={listStyle}>{items}</ul> : <ol key={index} start={block.start} style={listStyle}>{items}</ol>
    })}
  </div>
}
