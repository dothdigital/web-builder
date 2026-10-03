'use client'

import { useEffect, useState } from 'react'
import type { WebsiteModel } from '@awb/website-model'
import { getRecaptchaSettings, saveRecaptchaSettings } from '@/app/actions/integrations'

type Scripts = { head: string; bodyEnd: string }
export function ScriptFields({ value, onChange }: { value?: Scripts; onChange: (value: Scripts) => void }) {
  return <div className="grid gap-3">
    <p className="text-xs text-neutral-500">Paste complete HTML script tags. Runs in exported sites; disabled in the editor and authenticated preview.</p>
    {(['head', 'bodyEnd'] as const).map((position) => <label key={position} className="grid gap-1 text-xs">{position === 'head' ? 'Inside <head>' : 'Before </body>'}<textarea spellCheck={false} rows={6} maxLength={50000} className="w-full rounded border p-2 font-mono text-xs" value={value?.[position] ?? ''} onChange={(event) => onChange({ head: value?.head ?? '', bodyEnd: value?.bodyEnd ?? '', [position]: event.target.value })} /></label>)}
  </div>
}
export function IntegrationsPanel({ projectId, model, onChange }: { projectId: string; model: WebsiteModel; onChange: (model: WebsiteModel) => void }) {
  const [captcha, setCaptcha] = useState({ enabled: false, siteKey: '', hasSecret: false })
  const [secret, setSecret] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => { let active = true; getRecaptchaSettings(projectId).then((value) => { if (active) { setCaptcha(value); setLoaded(true) } }).catch(() => { if (active) setMessage('Could not load reCAPTCHA settings. Reopen this tab to retry.') }); return () => { active = false } }, [projectId])
  return <div className="grid gap-6 overflow-y-auto p-4">
    <label className="grid gap-2 text-sm font-semibold">Google Analytics 4<input className="rounded border p-2 text-xs font-normal" placeholder="G-XXXXXXXXXX" value={model.analyticsSettings.ga4MeasurementId ?? ''} onChange={(event) => onChange({ ...model, analyticsSettings: { ...model.analyticsSettings, ga4MeasurementId: event.target.value.trim().toUpperCase() } })} />{model.analyticsSettings.ga4MeasurementId && !/^G-[A-Z0-9]+$/.test(model.analyticsSettings.ga4MeasurementId) && <span className="text-xs text-red-700">Use a measurement ID starting with G-.</span>}<span className="text-xs font-normal text-neutral-500">Save the website to keep this setting. Tracking runs in the exported website.</span></label>
    <fieldset disabled={!loaded || busy} className="grid gap-3 rounded border p-3"><legend className="text-sm font-semibold">reCAPTCHA v2 checkbox</legend>
      <label className="text-xs"><input type="checkbox" checked={captcha.enabled} onChange={(event) => setCaptcha({ ...captcha, enabled: event.target.checked })} /> Protect contact forms</label>
      <label className="grid gap-1 text-xs">Site key<input className="rounded border p-2" value={captcha.siteKey} onChange={(event) => setCaptcha({ ...captcha, siteKey: event.target.value })} /></label>
      <label className="grid gap-1 text-xs">Secret key<input type="password" autoComplete="new-password" className="rounded border p-2" value={secret} placeholder={captcha.hasSecret ? 'Saved — leave blank to keep' : 'Enter secret key'} onChange={(event) => setSecret(event.target.value)} /></label>
      <p className="text-xs text-neutral-500">Register your website domain (and localhost for local tests) in Google reCAPTCHA. The secret is stored encrypted on the server and is never exported. Exported forms require this builder’s public form endpoint to stay online.</p>
      <button type="button" className="rounded bg-neutral-900 p-2 text-xs text-white" onClick={async () => { setBusy(true); setMessage(''); try { await saveRecaptchaSettings(projectId, { ...captcha, secret }); setCaptcha({ ...captcha, hasSecret: captcha.hasSecret || !!secret }); setSecret(''); setMessage('reCAPTCHA settings saved.') } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save settings.') } finally { setBusy(false) } }}>{busy ? 'Saving…' : 'Save reCAPTCHA settings'}</button>
    </fieldset>
    {message && <p role="status" className="text-xs">{message}</p>}
    <div className="grid gap-2"><h3 className="text-sm font-semibold">Global custom scripts</h3><ScriptFields value={model.customScripts} onChange={(customScripts) => onChange({ ...model, customScripts })} /></div>
  </div>
}
