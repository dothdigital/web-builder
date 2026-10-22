import assert from 'node:assert/strict'
import React, { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { JSDOM } from 'jsdom'
import { IntakeVoice } from '../apps/web/src/app/onboarding/intake-voice'

async function main() {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' })
  const events = { readyState: 'open', onopen: null as null | (() => void), onmessage: null as null | ((message: { data: string }) => void), send() {}, close() {} }
  let stops = 0
  const track = { enabled: false, stop() { stops++ } }
  class Peer {
    addTrack() {}
    createDataChannel() { return events }
    async createOffer() { return { sdp: 'offer' } }
    async setLocalDescription() {}
    async setRemoteDescription() { events.onopen?.() }
    close() {}
  }
  Object.assign(globalThis, { React, window: dom.window, document: dom.window.document, RTCPeerConnection: Peer, IS_REACT_ACT_ENVIRONMENT: true })
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [track] }) } } })
  Object.assign(dom.window, { RTCPeerConnection: Peer })
  globalThis.fetch = async () => new Response('answer')
  function Form() {
    const [value, setValue] = useState('Existing description')
    return <><textarea value={value} onChange={event => setValue(event.target.value)} /><IntakeVoice label="Description" value={value} onChange={setValue} /></>
  }
  const root = createRoot(document.getElementById('root')!)
  const emit = async (event: object) => { await act(async () => events.onmessage?.({ data: JSON.stringify(event) })) }
  await act(async () => root.render(<Form />))
  await act(async () => document.querySelector('button')!.click())
  assert.equal(track.enabled, true)
  await emit({ type: 'conversation.item.input_audio_transcription.delta', item_id: 'one', delta: 'We build' })
  assert.equal(document.querySelector('textarea')!.value, 'Existing description\n\nWe build')
  await emit({ type: 'conversation.item.input_audio_transcription.delta', item_id: 'one', delta: ' websites' })
  assert.equal(document.querySelector('textarea')!.value, 'Existing description\n\nWe build websites')
  await act(async () => document.querySelector('button')!.click())
  assert.equal(stops, 1, 'Stop must release the microphone before final transcription arrives')
  await emit({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'one', transcript: 'We build websites.' })
  assert.equal(document.querySelector('textarea')!.value, 'Existing description\n\nWe build websites.')
  await act(async () => document.querySelector('button')!.click())
  await emit({ type: 'conversation.item.input_audio_transcription.delta', item_id: 'two', delta: 'In Toronto.' })
  assert.equal(document.querySelector('textarea')!.value, 'Existing description\n\nWe build websites.\n\nIn Toronto.')
  await act(async () => root.unmount())
  assert.equal(stops, 2, 'Unmount must release the microphone')
  dom.window.close()
  console.log('PASS: live field updates, existing text preserved, immediate microphone stop, final text, repeated recording, and unmount cleanup.')
}
void main().catch(error => { console.error(error); process.exitCode = 1 })
