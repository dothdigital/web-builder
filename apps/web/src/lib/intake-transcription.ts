export const MAX_INTAKE_AUDIO_BYTES = 10 * 1024 * 1024

export function intakeAudioExtension(type: string): string | undefined {
  return ({ 'audio/webm': 'webm', 'audio/mp4': 'mp4', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/x-wav': 'wav' } as Record<string, string>)[type.split(';')[0]!.toLowerCase()]
}

export async function transcribeIntakeAudio(file: File, apiKey: string, fetcher: typeof fetch = fetch): Promise<string> {
  const extension = intakeAudioExtension(file.type)
  if (!extension || !file.size || file.size > MAX_INTAKE_AUDIO_BYTES) throw new Error('Record a short audio clip under 10 MB.')
  const body = new FormData()
  body.set('file', file, `intake.${extension}`)
  body.set('model', process.env.OPENAI_TRANSCRIPTION_MODEL || 'gpt-transcribe')
  body.set('response_format', 'json')
  const response = await fetcher('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body,
    signal: AbortSignal.timeout(90000),
  })
  if (!response.ok) throw new Error('We could not transcribe this recording. Try again or type your answer.')
  const result = await response.json() as { text?: unknown }
  if (typeof result.text !== 'string' || !result.text.trim()) throw new Error('No speech was detected. Please record again.')
  return result.text.trim()
}
