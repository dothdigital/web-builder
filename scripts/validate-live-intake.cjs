// TSX_TSCONFIG_PATH=apps/web/tsconfig.json node --import tsx scripts/validate-live-intake.cjs
// Mock microphone and provider only: no external calls or charges.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const React = require('react')
const { act } = React
const { createRoot } = require('react-dom/client')
const { JSDOM } = require('jsdom')
const { IntakeVoice } = require('../apps/web/src/app/onboarding/intake-voice.tsx')
const { createIntakeTranscriptionCall } = require('../apps/web/src/lib/intake-live-transcription.ts')

async function main() {
  let providerCalls = 0
  const fakeProvider = async (url, options) => {
    providerCalls++
    assert.equal(url, 'https://api.openai.com/v1/realtime/calls')
    assert.equal(options.headers.Authorization, 'Bearer server-only-key')
    assert.equal(options.body.get('sdp'), 'v=0\r\nm=audio')
    const session = JSON.parse(options.body.get('session'))
    assert.equal(session.type, 'transcription')
    assert.equal(session.audio.input.transcription.model, 'gpt-live-transcribe')
    assert.equal(session.audio.input.transcription.delay, 'low')
    assert.equal(session.audio.input.turn_detection, null)
    return new Response('v=0\r\nanswer')
  }
  assert.equal(await createIntakeTranscriptionCall('v=0\r\nm=audio', 'server-only-key', fakeProvider), 'v=0\r\nanswer')
  assert.equal(providerCalls, 1)
  await assert.rejects(createIntakeTranscriptionCall('v=0', 'key', async () => new Response('private upstream details', { status: 500 })), /could not connect/)

  const dom = new JSDOM('<div id="root"></div>', { url: 'https://webtummy.com/onboarding' })
  Object.assign(global, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true })
  let peer, track, usedText = '', rejectMicrophone = false
  Object.defineProperty(global, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia: async () => {
    if (rejectMicrophone) throw new Error('Microphone denied')
    track = { enabled: true, stopped: false, stop() { this.stopped = true } }
    return { getTracks: () => [track] }
  } } } })
  class Peer {
    constructor() { peer = this; this.connectionState = 'new' }
    addTrack() {}
    createDataChannel() { return this.events = { readyState: 'open', close() { this.readyState = 'closed' }, send: value => { this.sent = JSON.parse(value) } } }
    async createOffer() { return { type: 'offer', sdp: 'v=0\r\nm=audio' } }
    async setLocalDescription() {}
    async setRemoteDescription() { assert.equal(track.enabled, false); this.events.onopen() }
    close() { this.closed = true }
  }
  global.RTCPeerConnection = window.RTCPeerConnection = Peer
  global.fetch = async (url, options) => {
    assert.equal(url, '/api/intake/live'); assert.equal(options.headers['Content-Type'], 'application/sdp')
    return new Response('v=0\r\nanswer')
  }
  const root = createRoot(document.getElementById('root'))
  const button = label => [...document.querySelectorAll('button')].find(node => node.textContent === label)
  const render = async () => act(async () => root.render(React.createElement(IntakeVoice, { label: 'What does the business do?', onUseText: value => { usedText = value } })))
  const click = async label => { assert.ok(button(label), label); await act(async () => button(label).click()) }
  const emit = async event => act(async () => peer.events.onmessage({ data: JSON.stringify(event) }))
  await render()
  await click('Speak your answer')
  assert.equal(track.enabled, true)
  await emit({ type: 'conversation.item.input_audio_transcription.delta', item_id: 'one', delta: 'We renovate' })
  assert.equal(document.querySelector('textarea').value, 'We renovate', 'Words must appear before Stop')
  await emit({ type: 'conversation.item.input_audio_transcription.delta', item_id: 'one', delta: ' kitchens.' })
  assert.equal(document.querySelector('textarea').value, 'We renovate kitchens.')
  assert.equal(button('Use this text').disabled, true)
  await click('Stop')
  assert.equal(track.enabled, false)
  await act(async () => new Promise(resolve => setTimeout(resolve, 400)))
  assert.equal(peer.sent.type, 'input_audio_buffer.commit')
  await emit({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'one', transcript: 'We renovate kitchens in London.' })
  assert.equal(document.querySelector('textarea').value, 'We renovate kitchens in London.')
  assert.equal(track.stopped, true); assert.equal(peer.closed, true)
  assert.equal(document.querySelector('textarea').readOnly, false)
  await click('Use this text'); assert.equal(usedText, 'We renovate kitchens in London.')

  await click('Speak your answer')
  await emit({ type: 'conversation.item.input_audio_transcription.delta', item_id: 'two', delta: 'Keep this text' })
  await emit({ type: 'error', error: { code: 'connection_error' } })
  assert.equal(document.querySelector('textarea').value, 'Keep this text')
  assert.equal(track.stopped, true)
  rejectMicrophone = true
  await click('Speak your answer')
  assert.match(document.querySelector('[role="alert"]').textContent, /Microphone denied/)
  rejectMicrophone = false
  await click('Speak your answer')
  await act(async () => root.unmount())
  assert.equal(track.stopped, true); assert.equal(peer.closed, true)

  const wizard = fs.readFileSync(require('node:path').join(__dirname, '../apps/web/src/app/onboarding/onboarding-wizard.tsx'), 'utf8')
  assert.equal((wizard.match(/onVoiceText=/g) ?? []).length, 1)
  assert.match(wizard, /label="What does the business do\?"[^\n]*onVoiceText=/)
  assert.equal((wizard.match(/<IntakeVoice/g) ?? []).length, 1)
  console.log('PASS: live deltas before Stop, final reconciliation, explicit use, interruption recovery, microphone cleanup, server-only key and voice only on business description.')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
