/** User-authored code is executed only inside a sandboxed embed frame. */
export function embedDocument(html: string, css: string, javascript: string): string {
  const style = css.replace(/<\/style/gi, '<\\/style')
  const script = javascript.replace(/<\/script/gi, '<\\/script')
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif}img,video{max-width:100%;height:auto}${style}</style></head><body>${html}<script>${script}</script></body></html>`
}
