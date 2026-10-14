import { env } from '@awb/shared'
import { rateLimit } from '@/lib/account-security'
import { sameOriginRequest } from '@/lib/request-origin'
import { requireUser, withApiAuthorization } from '@/lib/tenancy'
import { readBoundedBody, RequestBodyTooLarge } from '@/lib/request-body'
import { intakeAudioExtension, MAX_INTAKE_AUDIO_BYTES, transcribeIntakeAudio } from '@/lib/intake-transcription'

export const runtime = 'nodejs'
export const maxDuration = 120

async function handlePOST(request: Request) {
  if (!sameOriginRequest(request)) return Response.json({ error: 'Origin not allowed' }, { status: 403 })
  const user = await requireUser()
  try { await rateLimit(`intake-voice:${user.id}`, 12, 15) }
  catch { return Response.json({ error: 'Please wait a few minutes before recording again.' }, { status: 429 }) }
  const apiKey = env().OPENAI_API_KEY
  if (!apiKey) return Response.json({ error: 'Voice input is unavailable. You can type your answer.' }, { status: 503 })
  let form: FormData
  try {
    const bytes = await readBoundedBody(request, MAX_INTAKE_AUDIO_BYTES + 65536)
    form = await new Response(bytes, { headers: { 'Content-Type': request.headers.get('content-type') ?? '' } }).formData()
  } catch (error) {
    return Response.json({ error: 'Record a valid audio clip under 10 MB.' }, { status: error instanceof RequestBodyTooLarge ? 413 : 400 })
  }
  const file = form.get('audio')
  if (!(file instanceof File) || !intakeAudioExtension(file.type) || !file.size || file.size > MAX_INTAKE_AUDIO_BYTES) return Response.json({ error: 'Record a short WebM, MP4, Ogg or WAV audio clip under 10 MB.' }, { status: 400 })
  try {
    const text = await transcribeIntakeAudio(file, apiKey)
    return Response.json({ text }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ error: 'We could not transcribe this recording. Try again or type your answer.' }, { status: 502 })
  }
}

export const POST = withApiAuthorization(handlePOST)
