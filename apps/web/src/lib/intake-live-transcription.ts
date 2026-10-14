// The standard API key stays on the server; browsers receive only an SDP answer.
export async function createIntakeTranscriptionCall(sdp: string, apiKey: string, fetcher: typeof fetch = fetch) {
  const body = new FormData()
  body.set('sdp', sdp)
  body.set('session', JSON.stringify({
    type: 'transcription',
    audio: { input: { transcription: { model: 'gpt-live-transcribe', delay: 'low' }, turn_detection: null } },
  }))
  const response = await fetcher('https://api.openai.com/v1/realtime/calls', {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body,
    signal: AbortSignal.timeout(20000),
  })
  if (!response.ok) throw new Error('Live transcription could not connect. Try again or use a recording.')
  const answer = await response.text()
  if (!answer.startsWith('v=0')) throw new Error('Live transcription returned an invalid connection.')
  return answer
}
