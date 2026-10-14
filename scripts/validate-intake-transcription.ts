import assert from 'node:assert/strict'
import { intakeAudioExtension, transcribeIntakeAudio } from '../apps/web/src/lib/intake-transcription'

async function main() {
  assert.equal(intakeAudioExtension('audio/webm;codecs=opus'), 'webm')
  assert.equal(intakeAudioExtension('audio/mp4'), 'mp4')
  assert.equal(intakeAudioExtension('text/plain'), undefined)
  const audio = new File(['audio-fixture'], 'clip', { type: 'audio/webm;codecs=opus' })
  let calls = 0
  const fake = (async (url: string, options: RequestInit) => {
    calls++
    assert.equal(url, 'https://api.openai.com/v1/audio/transcriptions')
    assert.equal(options.method, 'POST')
    const body = options.body as FormData
    assert.equal((body.get('file') as File).name, 'intake.webm')
    assert.equal(body.get('response_format'), 'json')
    return Response.json({ text: '  We renovate kitchens in London.  ' })
  }) as typeof fetch
  assert.equal(await transcribeIntakeAudio(audio, 'test-key', fake), 'We renovate kitchens in London.')
  assert.equal(calls, 1)
  await assert.rejects(transcribeIntakeAudio(new File(['bad'], 'bad', { type: 'text/plain' }), 'test-key', fake))
  assert.equal(calls, 1, 'Invalid files never reach the transcription provider')
  await assert.rejects(transcribeIntakeAudio(audio, 'test-key', (async () => Response.json({ text: '' })) as typeof fetch), /No speech/)
  await assert.rejects(transcribeIntakeAudio(audio, 'test-key', (async () => new Response('secret upstream details', { status: 500 })) as typeof fetch), /could not transcribe/)
  console.log('PASS: recording format validation, transcription request and text output, empty speech handling, safe provider failures.')
}
void main()
