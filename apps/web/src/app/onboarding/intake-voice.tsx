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

  useEffect(() => {
    mounted.current = true
    setSupported(typeof navigator.mediaDevices?.getUserMedia === 'function' && typeof window.MediaRecorder === 'function')
    return () => {
      mounted.current = false
      request.current?.abort()
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
      <button type="button" disabled={starting || transcribing} onClick={() => recording ? recorder.current?.stop() : void start()} className="rounded-md border bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-50" aria-label={`${recording ? 'Stop recording' : 'Record voice'} for ${label}`}>
        {recording ? 'Stop and transcribe' : starting ? 'Opening microphone…' : transcribing ? 'Turning voice into text…' : 'Record voice'}
      </button>
      {recording && <span role="status" className="text-xs text-red-700">Recording · {seconds}s / 120s</span>}
    </div>
    <p className="text-xs text-neutral-500">Speak for up to 2 minutes. AI transcribes your recording; review the text before using it.</p>
    {transcribing && <p role="status" className="text-xs">Transcribing your recording…</p>}
    {text && <>
      <label className="grid gap-1 text-xs">Review and edit transcript<textarea rows={3} value={text} onChange={event => setText(event.target.value)} className="rounded border p-2" /></label>
      <div className="flex gap-2"><button type="button" disabled={!text.trim() || transcribing || recording} onClick={() => { onUseText(text.trim()); setText(''); setAudio(undefined) }} className="rounded bg-neutral-900 px-3 py-1.5 text-xs text-white">Use this text</button><button type="button" onClick={() => { setText(''); setAudio(undefined) }} className="rounded border px-3 py-1.5 text-xs">Discard</button></div>
    </>}
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    {audio && error && <button type="button" disabled={transcribing} onClick={() => void transcribe(audio)} className="text-left text-xs underline">Retry transcription</button>}
  </div>
}
