'use client'

import { useEffect, useRef, useState } from 'react'

export function IntakeVoice({ label, onUseText }: { label: string; onUseText: (text: string) => void }) {
  const [supported, setSupported] = useState(false)
  const [recording, setRecording] = useState(false)
  const [starting, setStarting] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [transcribing, setTranscribing] = useState(false)
  const [text, setText] = useState('')
  const [audio, setAudio] = useState<Blob>()
  const [error, setError] = useState('')
  const [liveAvailable, setLiveAvailable] = useState(false)
  const [live, setLive] = useState(false)
  const peer = useRef<RTCPeerConnection | null>(null)
  const channel = useRef<RTCDataChannel | null>(null)
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stopping = useRef(false)
  const transcript = useRef('')
  const sessionId = useRef(0)
  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const mounted = useRef(true)
  const request = useRef<AbortController | null>(null)

  function releaseMicrophone() {
    if (timer.current) clearInterval(timer.current)
    timer.current = null
    stream.current?.getTracks().forEach(track => track.stop())
    stream.current = null
  }

  function closeLive() {
    if (finishTimer.current) clearTimeout(finishTimer.current)
    finishTimer.current = null
    const connection = peer.current
    peer.current = null
    channel.current?.close()
    channel.current = null
    connection?.close()
    releaseMicrophone()
  }

  function finishLive(message = '') {
    closeLive()
    if (!mounted.current) return
    setRecording(false)
    setStarting(false)
    setTranscribing(false)
    setError(message)
  }

  function stopLive() {
    if (stopping.current) return
    stopping.current = true
    stream.current?.getTracks().forEach(track => { track.enabled = false })
    if (timer.current) clearInterval(timer.current)
    timer.current = null
    setRecording(false)
    setTranscribing(true)
    // Give the media track time to deliver the last syllable before committing.
    finishTimer.current = setTimeout(() => {
      if (channel.current?.readyState !== 'open') { finishLive('Connection closed. Your live text is preserved.'); return }
      channel.current.send(JSON.stringify({ type: 'input_audio_buffer.commit' }))
      finishTimer.current = setTimeout(() => finishLive('Final transcription timed out. You can review and use the live text.'), 12000)
    }, 350)
  }

  async function startLive() {
    if (peer.current || starting || recording || transcribing) return
    const id = ++sessionId.current
    const active = () => mounted.current && id === sessionId.current
    setStarting(true); setError(''); setText(''); setAudio(undefined); setLive(true)
    transcript.current = ''; stopping.current = false
    const controller = new AbortController()
    request.current = controller
    try {
      const microphone = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!active()) { microphone.getTracks().forEach(track => track.stop()); return }
      stream.current = microphone
      // Start capturing speech only once the connection is ready.
      microphone.getTracks().forEach(track => { track.enabled = false })
      const connection = new RTCPeerConnection()
      peer.current = connection
      microphone.getTracks().forEach(track => connection.addTrack(track, microphone))
      const events = connection.createDataChannel('oai-events')
      channel.current = events
      const pieces = new Map<string, string>()
      const refreshText = () => { transcript.current = [...pieces.values()].join(' ').trim(); setText(transcript.current) }
      events.onmessage = message => {
        if (!active() || peer.current !== connection) return
        let event: { type?: string; item_id?: string; delta?: string; transcript?: string; error?: { code?: string } }
        try { event = JSON.parse(message.data) } catch { return }
        const key = event.item_id ?? 'current'
        if (event.type === 'conversation.item.input_audio_transcription.delta' && typeof event.delta === 'string') {
          pieces.set(key, (pieces.get(key) ?? '') + event.delta); refreshText()
        } else if (event.type === 'conversation.item.input_audio_transcription.completed' && typeof event.transcript === 'string') {
          pieces.set(key, event.transcript); refreshText()
          if (stopping.current) finishLive(transcript.current ? '' : 'No speech was detected. Please try again.')
        } else if (event.type === 'error' || event.type === 'conversation.item.input_audio_transcription.failed') {
          finishLive(stopping.current && event.error?.code === 'input_audio_buffer_commit_empty'
            ? (transcript.current ? '' : 'No speech was detected. Please try again.')
            : 'Live transcription was interrupted. Your text is preserved; try again or use a recording.')
        }
      }
      events.onclose = () => { if (active() && peer.current === connection) finishLive('Connection closed. Your live text is preserved.') }
      connection.onconnectionstatechange = () => {
        if (active() && peer.current === connection && connection.connectionState === 'failed') finishLive('Voice connection failed. Try again or use a recording.')
      }
      const ready = new Promise<void>((resolve, reject) => {
        events.onopen = () => resolve()
        controller.signal.addEventListener('abort', () => reject(new Error('Voice connection cancelled.')), { once: true })
      })
      // Attach a rejection handler while the HTTP handshake is in flight.
      void ready.catch(() => {})
      const timeout = setTimeout(() => controller.abort(), 25000)
      try {
        const offer = await connection.createOffer()
        await connection.setLocalDescription(offer)
        const response = await fetch('/api/intake/live', { method: 'POST', headers: { 'Content-Type': 'application/sdp' }, body: offer.sdp, signal: controller.signal })
        if (!response.ok) {
          const payload = await response.json()
          throw new Error(payload.error || 'Live transcription could not connect.')
        }
        if (!active()) return
        await connection.setRemoteDescription({ type: 'answer', sdp: await response.text() })
        await ready
      } finally { clearTimeout(timeout) }
      if (!active() || peer.current !== connection) return
      microphone.getTracks().forEach(track => { track.enabled = true })
      setStarting(false); setRecording(true); setSeconds(0)
      const startedAt = Date.now()
      timer.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAt) / 1000)
        setSeconds(elapsed)
        if (elapsed >= 120) stopLive()
      }, 1000)
    } catch (caught) {
      if (active()) finishLive(caught instanceof Error && caught.name !== 'AbortError' ? caught.message : 'Voice connection timed out. Try again or use a recording.')
    }
  }

  useEffect(() => {
    mounted.current = true
    setLiveAvailable(typeof window.RTCPeerConnection === 'function')
    setSupported(typeof navigator.mediaDevices?.getUserMedia === 'function' && (typeof window.RTCPeerConnection === 'function' || typeof window.MediaRecorder === 'function'))
    return () => {
      mounted.current = false
      sessionId.current++
      request.current?.abort()
      closeLive()
      if (recorder.current) {
        recorder.current.onstop = null
        if (recorder.current.state !== 'inactive') recorder.current.stop()
      }
      releaseMicrophone()
    }
  }, [])

  async function transcribe(blob: Blob) {
    setTranscribing(true)
    setError('')
    request.current = new AbortController()
    try {
      const body = new FormData()
      body.set('audio', blob, 'intake-recording')
      const response = await fetch('/api/intake/transcribe', { method: 'POST', body, signal: request.current.signal })
      const payload = await response.json()
      if (!response.ok || typeof payload.text !== 'string') throw new Error(payload.error || 'Transcription failed. Try again or type your answer.')
      if (mounted.current) setText(payload.text)
    } catch (caught) {
      if (mounted.current) setError(caught instanceof Error ? caught.message : 'Could not transcribe the recording.')
    } finally {
      if (mounted.current) setTranscribing(false)
    }
  }

  async function start() {
    setLive(false)
    setStarting(true)
    setError('')
    setText('')
    setAudio(undefined)
    try {
      const microphone = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!mounted.current) { microphone.getTracks().forEach(track => track.stop()); return }
      stream.current = microphone
      const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find(type => MediaRecorder.isTypeSupported(type))
      if (!type) throw new Error('This browser cannot record a supported format. Please type your answer.')
      const next = new MediaRecorder(microphone, { mimeType: type, audioBitsPerSecond: 64000 })
      recorder.current = next
      const chunks: Blob[] = []
      next.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
      next.onstop = () => {
        releaseMicrophone()
        if (!mounted.current) return
        setRecording(false)
        const blob = new Blob(chunks, { type: next.mimeType })
        setAudio(blob)
        void transcribe(blob)
      }
      next.onerror = () => { next.onstop = null; releaseMicrophone(); setRecording(false); setError('Recording failed. Try again or type your answer.') }
      next.start(1000)
      setSeconds(0)
      setRecording(true)
      const startedAt = Date.now()
      timer.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAt) / 1000)
        setSeconds(elapsed)
        if (elapsed >= 120 && next.state === 'recording') next.stop()
      }, 1000)
    } catch {
      releaseMicrophone()
      setError('Microphone access or recording is unavailable. Allow microphone access and try again, or type your answer.')
    } finally {
      if (mounted.current) setStarting(false)
    }
  }

  if (!supported) return <p className="mt-2 text-xs font-normal text-neutral-500">Voice input requires a browser with microphone recording support. You can type your answer.</p>
  return <div className="mt-2 grid gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-3 font-normal">
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={starting || transcribing} onClick={() => recording ? (live ? stopLive() : recorder.current?.stop()) : void (liveAvailable ? startLive() : start())} className="rounded-md border bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-50" aria-label={`${recording ? 'Stop recording' : 'Record voice'} for ${label}`}>
        {recording ? (live ? 'Stop' : 'Stop and transcribe') : starting ? 'Connecting microphone…' : transcribing ? 'Finishing transcript…' : liveAvailable ? 'Speak your answer' : 'Record voice'}
      </button>
      {recording && <span role="status" className="text-xs text-red-700">{live ? 'Listening — text appears as you speak' : 'Recording'} · {seconds}s / 120s</span>}
    </div>
    <p className="text-xs text-neutral-500">{liveAvailable ? 'Your words appear here while you speak. Stop when finished, then review and use the text.' : 'Speak for up to 2 minutes, then review and use the transcript.'}</p>
    {transcribing && <p role="status" className="text-xs">Finishing your transcript…</p>}
    {(text || recording && live) && <>
      <label className="grid gap-1 text-xs">{recording ? 'Live transcript' : 'Review and edit transcript'}<textarea rows={3} value={text} readOnly={recording || transcribing} onChange={event => setText(event.target.value)} placeholder="Start speaking…" className="rounded border p-2" /></label>
      <div className="flex gap-2"><button type="button" disabled={!text.trim() || transcribing || recording} onClick={() => { onUseText(text.trim()); setText(''); setAudio(undefined) }} className="rounded bg-neutral-900 px-3 py-1.5 text-xs text-white">Use this text</button><button type="button" disabled={recording || transcribing} onClick={() => { setText(''); setAudio(undefined) }} className="rounded border px-3 py-1.5 text-xs">Discard</button></div>
    </>}
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    {error && liveAvailable && !recording && !starting && !transcribing && typeof window.MediaRecorder === 'function' && <button type="button" onClick={() => void start()} className="text-left text-xs underline">Use a recording instead</button>}
    {audio && error && <button type="button" disabled={transcribing} onClick={() => void transcribe(audio)} className="text-left text-xs underline">Retry transcription</button>}
  </div>
}
