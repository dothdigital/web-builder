export function formatListSelection(text: string, start: number, end: number, mode: 'bullet' | 'number' | 'plain') {
  const from = start <= 0 ? 0 : text.lastIndexOf('\n', start - 1) + 1
  const selectionEnd = end > start && text[end - 1] === '\n' ? end - 1 : end
  const nextBreak = text.indexOf('\n', selectionEnd)
  const to = nextBreak < 0 ? text.length : nextBreak
  let number = 0
  const replacement = text.slice(from, to).split('\n').map(line => {
    const clean = line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '')
    if (!clean.trim() && to > from) return line
    number++
    return mode === 'bullet' ? `- ${clean}` : mode === 'number' ? `${number}. ${clean}` : clean
  }).join('\n')
  return { text: text.slice(0, from) + replacement + text.slice(to), start: from, end: from + replacement.length }
}
