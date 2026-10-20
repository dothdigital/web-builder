// Client-side image I/O shared by inline cropping and the Filerobot popup.
export async function loadEditableImage(projectId: string, source: string, signal: AbortSignal) {
  let response = source.startsWith('data:') || source.startsWith('blob:') ? undefined : await fetch(`/api/projects/${encodeURIComponent(projectId)}/editor-image?url=${encodeURIComponent(source)}`, { signal })
  if (!response || response.status === 404) response = await fetch(source, { signal })
  if (!response.ok) throw new Error('This image could not be loaded. Try again, or upload a copy to the image library.')
  const blob = await response.blob()
  if (blob.size > 20 * 1024 * 1024) throw new Error('This image is too large to edit. Upload a smaller copy first.')
  const preview = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.src = preview
    await image.decode()
    if (image.naturalWidth * image.naturalHeight > 24_000_000) throw new Error('This image is too large to edit. Upload an image under 24 megapixels.')
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
    return { image, release: () => URL.revokeObjectURL(preview) }
  } catch (error) { URL.revokeObjectURL(preview); throw error }
}

export async function saveEditedCanvas(projectId: string, canvas: HTMLCanvasElement, filename = 'edited-image.png') {
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error('Could not export this image.')), 'image/png'))
  if (blob.size > 5 * 1024 * 1024) throw new Error('The edited image is over 5 MB. Use Resize to reduce its dimensions, then save again.')
  const body = new FormData()
  body.set('projectId', projectId)
  body.set('kind', 'IMAGE')
  body.set('file', blob, filename)
  const response = await fetch('/api/assets', { method: 'POST', body })
  const payload = await response.json() as { asset?: { url: string }; error?: string }
  if (!response.ok || !payload.asset?.url) throw new Error(payload.error || 'Could not save this image. Please try again.')
  return payload.asset.url
}
