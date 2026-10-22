'use client'
import { UploadButton } from '@/components/upload-button'
import { ImageDirectionFields } from '@/components/image-direction-fields'
import type { ImageDirection } from '@awb/shared/image-direction'
import { ErrorNotice } from '@/components/error-notice'
import { LayoutGallery } from '@/components/account/layout-gallery'
import { layoutCatalogue } from '@awb/shared/layout-catalogue'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DesignTokens } from '@awb/website-model'
import { videoLinkSchema, type IntakeMedia } from '@awb/shared/intake-media'
import { designReferencesSchema, MAX_DESIGN_REFERENCES } from '@awb/shared/design-reference'
import { startingPalettes } from '@/lib/starting-palettes'
import { IntakeVoice } from './intake-voice'
import { ChipInput, mergeChipValues } from './chip-input'
import { GoogleField } from './google-field'
import { ContentDirectionFields } from '@/components/content-direction-fields'
import type { ContentDirection } from '@awb/shared/content-direction'
import {
  createProjectFromBrief,
  saveBrandColors,
  letAiChooseBrandColors,
  saveIntakeMedia,
  saveBusinessPresence,
  saveTestimonials,
  startGeneration,
} from '@/app/actions/projects'

interface PaletteSuggestion {
  id: string
  label: string
  rationale: string
  tokens: DesignTokens
}

interface Step {
  key: string
  title: string
  help: string
}

const steps: Step[] = [
  { key: 'brief', title: 'Your business', help: 'Only what we genuinely need. Anything you leave blank is never invented.' },
  { key: 'logo', title: 'Logo and colours', help: 'Upload a logo and we build the starting palette from it. You stay in control of every colour.' },
  { key: 'images', title: 'Photos & videos', help: 'Add personal photos, your team, products or work. Use them alongside AI images, and optionally include videos.' },
  {
    key: 'social',
    title: 'Social media',
    help: 'Add the profiles you want visitors to find on your website. All links are optional, or skip this step.',
  },
  {
    key: 'presence',
    title: 'Google & contact',
    help: 'Google Business Profile, contact details and analytics IDs. Anything you leave blank is simply left off the site.',
  },
  { key: 'proof', title: 'Reviews', help: 'Paste real customer reviews. We will never write testimonials for you.' },
]

const homepageSectionOptions = ['About us / Who we are', 'Our methodology / Approach', 'Why choose us'] as const

const socialNetworks = ['facebook', 'instagram', 'linkedin', 'x', 'youtube', 'tiktok'] as const

const weekdays = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const

const paletteFields: Array<{ key: keyof DesignTokens['palette']; label: string }> = [
  { key: 'background', label: 'Background' },
  { key: 'surface', label: 'Surface' },
  { key: 'foreground', label: 'Text' },
  { key: 'primary', label: 'Primary' },
  { key: 'accent', label: 'Accent' },
  { key: 'border', label: 'Border' },
]

export function OnboardingWizard({ templatesEnabled = true }: { templatesEnabled?: boolean }) {
  const router = useRouter()
  const [stepIndex, setStepIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [projectId, setProjectId] = useState<string>()
  const [layoutChosen, setLayoutChosen] = useState(false)
  const [templateId, setTemplateId] = useState<string>()

  const [homepageLength, setHomepageLength] = useState<'compact' | 'expanded'>('expanded')
  const [homepageSections, setHomepageSections] = useState<Array<typeof homepageSectionOptions[number]>>([])
  const [businessName, setBusinessName] = useState('')
  const [description, setDescription] = useState('')
  const [references, setReferences] = useState<Array<{ id: string; url: string; mode: 'layout' | 'style' | 'both'; notes: string }>>([{ id: 'reference-first', url: '', mode: 'both', notes: '' }])
  const updateReference = (id: string, patch: Partial<Omit<typeof references[number], 'id'>>) => setReferences(current => current.map(reference => reference.id === id ? { ...reference, ...patch } : reference))
  const [industries, setIndustries] = useState<string[]>([])
  const [industryInput, setIndustryInput] = useState('')
  const [serviceAreas, setServiceAreas] = useState<string[]>([])
  const [serviceAreaInput, setServiceAreaInput] = useState('')
  const [separateServiceAreaSection, setSeparateServiceAreaSection] = useState(false)
  const [phone, setPhone] = useState('')
  const [additionalPhones, setAdditionalPhones] = useState<Array<{ id: string; value: string }>>([])
  const [email, setEmail] = useState('')
  const [tones, setTones] = useState<string[]>([])
  const [toneInput, setToneInput] = useState('')
  const [primaryConversion, setPrimaryConversion] = useState<'CALL' | 'WHATSAPP' | 'FORM' | 'BOOKING_URL' | 'QUOTE'>('FORM')
  const [services, setServices] = useState<string[]>([])
  const [serviceInput, setServiceInput] = useState('')


  const [logoColors, setLogoColors] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<PaletteSuggestion[]>(startingPalettes)
  const [selectedPalette, setSelectedPalette] = useState<DesignTokens>()
  const [logoPreview, setLogoPreview] = useState<string>()
  const [localLogoPreview, setLocalLogoPreview] = useState<string>()

  useEffect(() => {
    return () => {
      if (localLogoPreview) URL.revokeObjectURL(localLogoPreview)
    }
  }, [localLogoPreview])

  const [contentDirection, setContentDirection] = useState<ContentDirection>({ style: 'auto', styles: [], audience: '', notes: '' })
  const [imageDirection, setImageDirection] = useState<ImageDirection>({ style: 'auto', styles: [], notes: '' })
  const [imageMode, setImageMode] = useState<'upload' | 'generate' | 'mixed'>('mixed')
  const [uploadedImages, setUploadedImages] = useState<Array<IntakeMedia['photos'][number] & { url: string; name: string }>>([])
  const [videos, setVideos] = useState<IntakeMedia['videos']>([])
  const [videoUrl, setVideoUrl] = useState('')
  const [videoTitle, setVideoTitle] = useState('')

  const [socials, setSocials] = useState<Record<string, string>>({})
  const [googleBusinessUrl, setGoogleBusinessUrl] = useState('')
  const [googleMapsUrl, setGoogleMapsUrl] = useState('')
  const [googlePlaceId, setGooglePlaceId] = useState('')
  const [ga4MeasurementId, setGa4MeasurementId] = useState('')
  const [gtmContainerId, setGtmContainerId] = useState('')
  const [googleVerification, setGoogleVerification] = useState('')
  const [addressLine1, setAddressLine1] = useState('')
  const [addressCity, setAddressCity] = useState('')
  const [addressRegion, setAddressRegion] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [country, setCountry] = useState('')
  const [hours, setHours] = useState<Array<{ day: string; opens: string; closes: string; closed: boolean }>>(
    weekdays.map((day) => ({ day, opens: '', closes: '', closed: false })),
  )

  const [testimonials, setTestimonials] = useState<Array<{ quote: string; author: string; source?: string }>>([])
  const [testimonialDraft, setTestimonialDraft] = useState({ quote: '', author: '', source: '' })

  const step = steps[stepIndex]!

  async function handleCreateProject() {
    setBusy(true)
    setError(undefined)

    try {
      const inspiration = references.filter(reference => reference.url.trim() || reference.notes.trim())
      if (inspiration.some(reference => !reference.url.trim())) throw new Error('Add a website address for each inspiration description, or remove that reference.')
      const parsedReferences = designReferencesSchema.safeParse(inspiration)
      if (!parsedReferences.success) throw new Error(parsedReferences.error.issues[0]?.message || 'Check the reference website addresses')
      const { projectId: created } = await createProjectFromBrief({
        ...(templatesEnabled && templateId ? { templateId } : {}),
        businessName,
        homepageLength,
        homepageSections: [...homepageSections, ...(separateServiceAreaSection && mergeChipValues(serviceAreas, serviceAreaInput).length ? ['Service areas' as const] : [])],
        description,
        ...(parsedReferences.data.length ? { designReferences: parsedReferences.data } : {}),
        industry: mergeChipValues(industries, industryInput).join(', '),
        serviceAreas: mergeChipValues(serviceAreas, serviceAreaInput),
        phone,
        additionalPhones: additionalPhones.map(entry => entry.value.trim()).filter(Boolean),
        email,
        tone: mergeChipValues(tones, toneInput).join(', '),
        primaryConversion,
        services: mergeChipValues(services, serviceInput),
        testimonials: [],
      })

      setProjectId(created)
      setStepIndex(1)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save your brief')
    } finally {
      setBusy(false)
    }
  }

  async function handleLogoUpload(file: File) {
    if (!projectId) return
    if (file.size > 5 * 1024 * 1024) {
      setError('Choose a logo of 5 MB or smaller.')
      return
    }
    setLocalLogoPreview(URL.createObjectURL(file))
    setBusy(true)
    setError(undefined)

    try {
      const body = new FormData()
      body.set('projectId', projectId)
      body.set('kind', 'LOGO')
      body.set('file', file)

      const response = await fetch('/api/assets', { method: 'POST', body })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      const payload = (await response.json()) as {
        asset: { url: string }
        previewUrl?: string
        colors: Array<{ hex: string }>
        suggestions: PaletteSuggestion[]
      }

      setLogoPreview(payload.previewUrl ?? payload.asset.url)
      setLogoColors(payload.colors.map((color) => color.hex))
      setSuggestions(payload.suggestions)
      setSelectedPalette(payload.suggestions[0]?.tokens)
    } catch (caught) {
      setLocalLogoPreview(undefined)
      setError(caught instanceof Error ? caught.message : 'Logo upload failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleImageUpload(fileList: FileList) {
    if (!projectId) return
    setBusy(true)
    setError(undefined)

    try {
      if (uploadedImages.length + fileList.length > 30) throw new Error('You can upload up to 30 photos.')
      for (const file of Array.from(fileList)) {
        if (file.size > 5 * 1024 * 1024) throw new Error(`${file.name}: choose an image of 5 MB or smaller.`)
        const body = new FormData()
        body.set('projectId', projectId)
        body.set('kind', 'IMAGE')
        body.set('file', file)
        const response = await fetch('/api/assets', { method: 'POST', body })
        const payload = (await response.json()) as { asset?: { id: string; url: string }; previewUrl?: string; error?: string }
        if (!response.ok || !payload.asset) throw new Error(payload.error || `Could not upload ${file.name}`)

        if (payload.asset) {
          setUploadedImages((current) => [...current, { assetId: payload.asset!.id, url: payload.previewUrl ?? payload.asset!.url, name: file.name, purpose: 'other', description: '' }])
          setImageMode(current => current === 'generate' ? 'mixed' : current)
        }
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Image upload failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveMedia() {
    if (!projectId) return
    setBusy(true)
    setError(undefined)
    try {
      let savedVideos = videos
      if (videoUrl.trim() || videoTitle.trim()) {
        const result = videoLinkSchema.safeParse(videoUrl)
        if (!result.success) throw new Error(result.error.issues[0]?.message)
        if (!videoTitle.trim()) throw new Error('Add a title for your video.')
        savedVideos = [...videos, { url: result.data, title: videoTitle.trim() }]
      }
      await saveIntakeMedia(projectId, { imageMode, contentDirection, ...(imageMode !== 'upload' ? { imageDirection } : {}), photos: uploadedImages.map(({ assetId, purpose, description }) => ({ assetId, purpose, description })), videos: savedVideos })
      setVideos(savedVideos)
      setVideoUrl('')
      setVideoTitle('')
      setStepIndex(3)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save your photos and videos')
    } finally { setBusy(false) }
  }

  async function handleSaveSocials(skip = false) {
    if (!projectId) return
    setBusy(true)
    setError(undefined)
    try {
      const links = skip ? [] : Object.entries(socials)
        .filter(([, url]) => url.trim().length > 0)
        .map(([network, url]) => ({ network, url: url.trim() }))
      await saveBusinessPresence(projectId, { socials: links })
      if (skip) setSocials({})
      setStepIndex(4)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save your social links')
    } finally {
      setBusy(false)
    }
  }

  async function handleSavePresence() {
    if (!projectId) return
    setBusy(true)
    setError(undefined)

    try {
      await saveBusinessPresence(projectId, {
        socials: Object.entries(socials)
          .filter(([, url]) => url.trim().length > 0)
          .map(([network, url]) => ({ network, url: url.trim() })),
        googleBusinessUrl,
        googleMapsUrl,
        googlePlaceId,
        ga4MeasurementId,
        gtmContainerId,
        googleVerification,
        addressLine1,
        city: addressCity,
        region: addressRegion,
        postalCode,
        country,
        hours,
      })

      setStepIndex(5)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save those details')
    } finally {
      setBusy(false)
    }
  }

  async function handleFinish() {
    if (!projectId) return
    setBusy(true)
    setError(undefined)

    try {
      const hasPendingReview = Object.values(testimonialDraft).some((value) => value.trim().length > 0)
      const reviews = hasPendingReview ? [...testimonials, testimonialDraft] : testimonials
      await saveTestimonials(projectId, reviews)
      setTestimonials(reviews)
      setTestimonialDraft({ quote: '', author: '', source: '' })
      if (selectedPalette) {
        await saveBrandColors(projectId, selectedPalette, logoColors)
      } else {
        await letAiChooseBrandColors(projectId, logoColors)
      }

      const { correlationId } = await startGeneration(projectId)
      router.push(`/projects/${projectId}/progress?correlationId=${correlationId}`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not start generation')
      setBusy(false)
    }
  }

  if (templatesEnabled && !layoutChosen) return <LayoutGallery onSelect={id => { setTemplateId(id); setLayoutChosen(true); setError(undefined) }} />

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      {templatesEnabled && !projectId && <div className="wt-notice mb-6 flex flex-wrap items-center justify-between gap-3"><span>Selected layout: <strong>{layoutCatalogue.find(layout => layout.id === templateId)?.name || 'Let AI choose the layout'}</strong></span><button type="button" className="wt-button secondary" disabled={busy} onClick={() => setLayoutChosen(false)}>Change layout</button></div>}
      <ol aria-label="Website setup steps" className="flex flex-nowrap gap-2 overflow-x-auto pb-2 text-sm text-neutral-500">
        {steps.map((entry, index) => (
          <li key={entry.key} aria-current={index === stepIndex ? 'step' : undefined} className={`shrink-0 whitespace-nowrap ${index === stepIndex ? 'font-semibold text-neutral-900' : ''}`}>
            {index + 1}. {entry.title}
            {index < steps.length - 1 ? ' ·' : ''}
          </li>
        ))}
      </ol>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight">{step.title}</h1>
      <p className="mt-2 text-sm text-neutral-600">{step.help}</p>

      {error && <ErrorNotice code="WT-UPLOAD-001" message={error} className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700" />}

      {step.key === 'brief' && (
        <div className="mt-8 grid gap-4 rounded-lg border border-neutral-200 bg-white p-6">
          <Field label="Business name">
            <input className={inputClass} value={businessName} onChange={(event) => setBusinessName(event.target.value)} />
          </Field>
          <Field label="What does the business do?" hint="A few sentences. This drives the whole site." voiceValue={description} onVoiceText={setDescription}>
            <textarea
              className={inputClass}
              rows={5}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <ChipInput id="industry-input" label="Industry" values={industries} draft={industryInput} onValuesChange={setIndustries} onDraftChange={setIndustryInput} placeholder="e.g. construction, renovation" />
            <div>
              <ChipInput id="service-area-input" label="City or service area" values={serviceAreas} draft={serviceAreaInput} onValuesChange={setServiceAreas} onDraftChange={setServiceAreaInput} placeholder="e.g. Toronto, Mississauga" />
              <label className="mt-2 flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1" checked={separateServiceAreaSection} onChange={event => setSeparateServiceAreaSection(event.target.checked)} aria-describedby="service-area-help" />
                Add a separate service-area section
              </label>
              <p id="service-area-help" className="mt-1 text-xs text-neutral-500">Leave unchecked to mention your city or service area naturally in the introduction only.</p>
            </div>
            <div className="grid gap-2">
              <Field label="Phone"><input type="tel" autoComplete="tel" className={inputClass} value={phone} onChange={event => setPhone(event.target.value)} /></Field>
              {additionalPhones.map((entry, index) => <div key={entry.id} className="flex items-end gap-2">
                <Field label={`Additional phone ${index + 1}`}><input type="tel" className={inputClass} value={entry.value} onChange={event => setAdditionalPhones(current => current.map(item => item.id === entry.id ? { ...item, value: event.target.value } : item))} /></Field>
                <button type="button" className="mb-2 px-2 text-sm" aria-label={`Remove additional phone ${index + 1}`} onClick={() => setAdditionalPhones(current => current.filter(item => item.id !== entry.id))}>×</button>
              </div>)}
              {additionalPhones.length < 19 && <button type="button" className="text-left text-xs underline" onClick={() => setAdditionalPhones(current => [...current, { id: crypto.randomUUID(), value: '' }])}>Add another phone number</button>}
            </div>
            <Field label="Email">
              <input className={inputClass} value={email} onChange={(event) => setEmail(event.target.value)} />
            </Field>
            <ChipInput id="tone-input" label="Tone" values={tones} draft={toneInput} onValuesChange={setTones} onDraftChange={setToneInput} placeholder="e.g. warm, premium, direct" />
            <Field label="Main action for visitors">
              <select
                className={inputClass}
                value={primaryConversion}
                onChange={(event) => setPrimaryConversion(event.target.value as typeof primaryConversion)}
              >
                <option value="FORM">Send an enquiry</option>
                <option value="CALL">Call</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="BOOKING_URL">Book online</option>
                <option value="QUOTE">Request a quote</option>
              </select>
            </Field>
          </div>
          {!templateId && <fieldset className="grid gap-3 rounded-lg border border-neutral-200 p-4">
            <legend className="px-1 text-sm font-medium">Homepage length</legend>
            <p className="text-sm text-neutral-500">Choose how much of your business story to show on the homepage. Service detail pages are included with either option.</p>
            <label className="flex items-start gap-3 rounded-md border border-neutral-200 p-3">
              <input type="radio" name="homepageLength" value="expanded" checked={homepageLength === 'expanded'} onChange={() => setHomepageLength('expanded')} className="mt-1" />
              <span><span className="block text-sm font-medium">Expanded · 5–6 sections</span><span className="text-xs text-neutral-500">A longer page with a hero, services, your story, supporting content and an enquiry section. AI chooses the mix for your business.</span></span>
            </label>
            <label className="flex items-start gap-3 rounded-md border border-neutral-200 p-3">
              <input type="radio" name="homepageLength" value="compact" checked={homepageLength === 'compact'} onChange={() => setHomepageLength('compact')} className="mt-1" />
              <span><span className="block text-sm font-medium">Compact · 3–4 sections</span><span className="text-xs text-neutral-500">A shorter introduction focused on key services and enquiries.</span></span>
            </label>
          </fieldset>}
          <fieldset className="grid gap-3 rounded-lg border border-neutral-200 p-4">
            <legend className="px-1 text-sm font-medium">Homepage topics (optional)</legend>
            <p className="text-sm text-neutral-500">Leave blank for AI to choose. Selected topics will be covered; related topics may share a section to fit your chosen page length. Add your approach, strengths and areas served in the business description so the content reflects your business.</p>
            {homepageSectionOptions.map((topic) => (
              <label key={topic} className="flex items-center gap-3 text-sm">
                <input type="checkbox" checked={homepageSections.includes(topic)} onChange={(event) => setHomepageSections((current) => event.target.checked ? [...current, topic] : current.filter((item) => item !== topic))} />
                {topic}
              </label>
            ))}
          </fieldset>
          <fieldset className="grid gap-3 rounded-lg border border-neutral-200 p-4">
            <legend className="px-1 text-sm font-medium">Design inspiration (optional)</legend>
            <p className="text-sm text-neutral-500">Add up to {MAX_DESIGN_REFERENCES} websites and tell us what you like about each. You can type or speak your notes.</p>
            {references.map((reference, index) => <div key={reference.id} className="grid gap-3 rounded-md border border-neutral-200 p-3">
              <label className="grid gap-1 text-sm">Reference website {index + 1}<input className={inputClass} value={reference.url} onChange={event => updateReference(reference.id, { url: event.target.value })} placeholder="https://www.example.com" autoComplete="url" /></label>
              <label className="grid gap-1 text-sm">What should inspire your design?<select className={inputClass} value={reference.mode} onChange={event => updateReference(reference.id, { mode: event.target.value as typeof reference.mode })}><option value="both">Layout and visual style</option><option value="layout">Layout and section arrangement</option><option value="style">Visual style, colours and typography</option></select></label>
              <Field label={`What do you like—or want changed? (website ${index + 1})`} voiceValue={reference.notes} onVoiceText={text => updateReference(reference.id, { notes: text })}>
                <textarea className={inputClass} rows={3} maxLength={1500} value={reference.notes} onChange={event => updateReference(reference.id, { notes: event.target.value })} placeholder="For example: use the large project images, but keep my brand colours and a simpler menu." />
              </Field>
              <button type="button" className="text-left text-xs underline" onClick={() => setReferences(current => current.filter(item => item.id !== reference.id))}>Remove website {index + 1}</button>
            </div>)}
            {references.length < MAX_DESIGN_REFERENCES && <button type="button" className={secondaryButton} onClick={() => setReferences(current => [...current, { id: crypto.randomUUID(), url: '', mode: 'both', notes: '' }])}>Add another website</button>}
            <p className="text-xs text-neutral-500">AI combines your references and notes into an original design. Your uploaded branding takes priority. If a site blocks access, we continue with your brief and notes. Leave blank to let AI choose.</p>
          </fieldset>
          <ChipInput id="service-input" label="Services" values={services} draft={serviceInput} onValuesChange={setServices} onDraftChange={setServiceInput} placeholder="Type a service, then press Enter or comma" />
          <button
            type="button"
            disabled={busy || businessName.length < 2 || description.length < 20}
            className={primaryButton}
            onClick={handleCreateProject}
          >
            {busy ? 'Saving…' : 'Continue'}
          </button>
        </div>
      )}

      {step.key === 'logo' && (
        <div className="mt-8 grid gap-6 rounded-lg border border-neutral-200 bg-white p-6">
          <Field label="Do you have a logo?" hint="PNG or SVG · up to 5 MB. We read its dominant colours and propose a palette.">
            <UploadButton label="Upload logo" inputLabel="Choose logo file" className="wt-button w-fit disabled:opacity-50" accept="image/*" disabled={busy} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void handleLogoUpload(file) }} />
          </Field>

          {(localLogoPreview || logoPreview) && (
            <div className="grid gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
              <p className="text-sm font-medium">Your logo</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={localLogoPreview || logoPreview} alt="Uploaded logo" className="h-24 w-full object-contain" />
              {busy && <p role="status" className="text-sm text-neutral-600">Uploading your logo and finding colour options…</p>}
            </div>
          )}

          {logoColors.length > 0 && (
            <div>
              <p className="text-sm font-medium">Colours found in your logo</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {logoColors.map((color) => (
                  <span key={color} className="flex items-center gap-2 rounded-md border border-neutral-200 px-2 py-1 text-xs">
                    <span className="h-4 w-4 rounded" style={{ background: color }} />
                    {color}
                  </span>
                ))}
              </div>
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="grid gap-3">
              <p className="text-sm font-medium">{logoPreview ? 'Suggested palettes from your logo' : 'Choose your website colours'}</p>
              {!logoPreview && <p className="text-sm text-neutral-600">No logo yet? Choose a combination below or let AI choose. You can add your logo and change colours later.</p>}
              {suggestions.map((suggestion) => (
                <button
                  type="button"
                  key={suggestion.id}
                  onClick={() => setSelectedPalette(suggestion.tokens)}
                  aria-pressed={selectedPalette === suggestion.tokens}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-left ${
                    selectedPalette === suggestion.tokens ? 'border-neutral-900' : 'border-neutral-200'
                  }`}
                >
                  <span>
                    <span className="block text-sm font-medium">{suggestion.label}</span>
                    <span className="block text-xs text-neutral-500">{suggestion.rationale}</span>
                  </span>
                  <span className="flex gap-1">
                    {paletteFields.map(field => (
                      <span key={field.key} className="h-6 w-6 rounded border border-black/10" style={{ background: suggestion.tokens.palette[field.key] }} title={`${field.label}: ${suggestion.tokens.palette[field.key]}`} aria-label={`${field.label}: ${suggestion.tokens.palette[field.key]}`} />
                    ))}
                  </span>
                </button>
              ))}
              <button type="button" aria-pressed={!selectedPalette} onClick={() => setSelectedPalette(undefined)} className={`rounded-md border p-3 text-left text-sm ${!selectedPalette ? 'border-neutral-900' : 'border-neutral-200'}`}>
                Let AI choose my colours
              </button>
            </div>
          )}

          {selectedPalette && (
            <div>
              <p className="text-sm font-medium">Fine-tune any colour</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-3">
                {paletteFields.map((field) => (
                  <label key={field.key} className="text-xs text-neutral-600">
                    {field.label}
                    <span className="mt-1 flex items-center gap-2">
                      <input
                        type="color"
                        value={selectedPalette.palette[field.key]}
                        onChange={(event) =>
                          setSelectedPalette((current) =>
                            current
                              ? { ...current, palette: { ...current.palette, [field.key]: event.target.value } }
                              : current,
                          )
                        }
                      />
                      <input
                        className="w-24 rounded border border-neutral-300 px-2 py-1 text-xs"
                        value={selectedPalette.palette[field.key]}
                        onChange={(event) =>
                          setSelectedPalette((current) =>
                            current
                              ? { ...current, palette: { ...current.palette, [field.key]: event.target.value } }
                              : current,
                          )
                        }
                      />
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <StepNav
            onBack={() => setStepIndex(0)}
            onNext={() => setStepIndex(2)}
            nextLabel={logoPreview || selectedPalette ? 'Continue' : 'Continue — let AI choose'}
            busy={busy}
          />
        </div>
      )}

      {step.key === 'images' && (
        <div className="mt-8 grid gap-6 rounded-lg border border-neutral-200 bg-white p-6">
          <div className="grid gap-2">
            {(
              [
                ['upload', 'Use only my photos (reuse them where needed)'],
                ['generate', 'Use AI-generated images only'],
                ['mixed', 'Mix: use my photos, generate the rest'],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="imageMode"
                  disabled={busy}
                  checked={imageMode === value}
                  onChange={() => setImageMode(value)}
                />
                {label}
              </label>
            ))}
          </div>

          {imageMode !== 'upload' && <ImageDirectionFields value={imageDirection} onChange={setImageDirection} disabled={busy} />}

          <div className="grid justify-items-start gap-2">
            <p className="text-sm font-medium">Upload your photos</p>
            <p id="photos-upload-help" className="text-xs text-neutral-500">Personal or team photos, products, premises and examples of your work. Up to 30 images, 5 MB each. You can add photos alongside AI images.</p>
            <UploadButton label="Upload images" inputLabel="Upload your photos" accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml" multiple disabled={busy} className={primaryButton} describedBy="photos-upload-help" onChange={event => { if (event.target.files) void handleImageUpload(event.target.files); event.target.value = '' }} />
          </div>
          {uploadedImages.length > 0 && <div className="grid gap-4 sm:grid-cols-2">
            {uploadedImages.map((photo, index) => <div key={photo.assetId} className="grid gap-2 rounded border p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt={photo.description || photo.name} className="h-32 w-full rounded object-contain" />
              <span className="truncate text-xs">{photo.name}</span>
              <label className="grid gap-1 text-sm">What is this photo of?
                <select className={inputClass} value={photo.purpose} disabled={busy} onChange={event => setUploadedImages(current => current.map((entry, i) => i === index ? { ...entry, purpose: event.target.value as typeof photo.purpose } : entry))}>
                  <option value="personal">Me or my team</option><option value="product">Products or services</option><option value="work">Projects or examples of our work</option><option value="other">Premises or other images</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm">Description (optional)<input className={inputClass} maxLength={300} value={photo.description} placeholder="For example: Sarah, owner of the business" disabled={busy} onChange={event => setUploadedImages(current => current.map((entry, i) => i === index ? { ...entry, description: event.target.value } : entry))} /></label>
              <button type="button" disabled={busy} className="text-left text-sm underline" onClick={() => setUploadedImages(current => current.filter(entry => entry.assetId !== photo.assetId))}>Remove from this website</button>
            </div>)}
          </div>}
          <div className="grid gap-3 border-t pt-4">
            <p className="text-sm font-medium">Videos (optional)</p>
            <p className="text-sm text-neutral-600">Paste a YouTube, Vimeo, or direct MP4/WebM HTTPS link. The video will appear on your homepage with playback controls. Video files can be hosted elsewhere and linked here.</p>
            {videos.map((video, index) => <div key={`${video.url}-${index}`} className="flex items-center justify-between gap-2 text-sm"><span className="truncate">{video.title}</span><button type="button" disabled={busy} className="underline" onClick={() => setVideos(current => current.filter((_, i) => i !== index))}>Remove</button></div>)}
            {videos.length < 5 && <>
              <Field label="Video title"><input className={inputClass} value={videoTitle} maxLength={120} disabled={busy} onChange={event => setVideoTitle(event.target.value)} placeholder="Meet our team" /></Field>
              <Field label="Video link"><input type="url" className={inputClass} value={videoUrl} maxLength={2048} disabled={busy} onChange={event => setVideoUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=..." /></Field>
              <button type="button" disabled={busy} className="text-left text-sm underline" onClick={() => {
                const result = videoLinkSchema.safeParse(videoUrl)
                if (!result.success) { setError(result.error.issues[0]?.message); return }
                if (!videoTitle.trim()) { setError('Add a title for your video.'); return }
                setVideos(current => [...current, { url: result.data, title: videoTitle.trim() }]); setVideoUrl(''); setVideoTitle(''); setError(undefined)
              }}>Add video</button>
            </>}
          </div>
          <ContentDirectionFields value={contentDirection} onChange={setContentDirection} disabled={busy} />
          <StepNav onBack={() => setStepIndex(1)} onNext={() => void handleSaveMedia()} nextLabel="Continue" busy={busy} />
        </div>
      )}

      {step.key === 'social' && (
        <div className="mt-8 grid gap-6 rounded-lg border border-neutral-200 bg-white p-6">
          <div className="grid gap-3">
            <p className="text-sm font-medium">Social profiles <span className="font-normal text-neutral-500">(optional)</span></p>
            {socialNetworks.map((network) => (
              <Field key={network} label={network[0]!.toUpperCase() + network.slice(1)} hint="Optional">
                <input
                  type="url"
                  autoComplete="url"
                  className={inputClass}
                  placeholder={`https://${network === 'x' ? 'x.com' : `${network}.com`}/yourbusiness`}
                  value={socials[network] ?? ''}
                  onChange={(event) =>
                    setSocials((current) => ({ ...current, [network]: event.target.value }))
                  }
                />
              </Field>
            ))}
          </div>

          <p className="text-sm text-neutral-500">Saved profiles appear in your website footer. Leave any networks you do not use blank.</p>
          <StepNav
            onBack={() => setStepIndex(2)}
            onNext={() => handleSaveSocials()}
            onSkip={() => handleSaveSocials(true)}
            nextLabel={busy ? 'Saving…' : 'Save and continue'}
            busy={busy}
          />
        </div>
      )}

      {step.key === 'presence' && (
        <div className="mt-8 grid gap-6 rounded-lg border border-neutral-200 bg-white p-6">
          <div className="grid gap-3">
            <p className="text-sm font-medium">Google</p>
            <GoogleField kind="business" value={googleBusinessUrl} onChange={setGoogleBusinessUrl} />
            <GoogleField kind="maps" value={googleMapsUrl} onChange={setGoogleMapsUrl} />
            <div className="grid gap-3 sm:grid-cols-2">
              <GoogleField kind="place" hint="Optional" value={googlePlaceId} onChange={setGooglePlaceId} />
              <GoogleField kind="analytics" hint="G-XXXXXXX" value={ga4MeasurementId} onChange={setGa4MeasurementId} />
              <GoogleField kind="tagManager" hint="GTM-XXXXXX" value={gtmContainerId} onChange={setGtmContainerId} />
              <GoogleField kind="verification" hint="Meta tag content value" value={googleVerification} onChange={setGoogleVerification} />
            </div>
          </div>

          <div className="grid gap-3">
            <p className="text-sm font-medium">Address and opening hours</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Street address">
                <input className={inputClass} value={addressLine1} onChange={(event) => setAddressLine1(event.target.value)} />
              </Field>
              <Field label="City">
                <input className={inputClass} autoComplete="address-level2" value={addressCity} onChange={event => setAddressCity(event.target.value)} />
              </Field>
              <Field label="Province / State">
                <input className={inputClass} autoComplete="address-level1" value={addressRegion} onChange={event => setAddressRegion(event.target.value)} />
              </Field>
              <Field label="Postcode">
                <input className={inputClass} value={postalCode} onChange={(event) => setPostalCode(event.target.value)} />
              </Field>
              <Field label="Country">
                <input className={inputClass} value={country} onChange={(event) => setCountry(event.target.value)} />
              </Field>
            </div>
            <div className="grid gap-2">
              {hours.map((entry, index) => (
                <div key={entry.day} className="flex items-center gap-3 text-sm">
                  <span className="w-24 text-neutral-600">{entry.day}</span>
                  <input
                    type="time"
                    className="rounded-md border border-neutral-300 px-2 py-1 text-sm disabled:opacity-40"
                    value={entry.opens}
                    disabled={entry.closed}
                    onChange={(event) =>
                      setHours((current) =>
                        current.map((row, position) => (position === index ? { ...row, opens: event.target.value } : row)),
                      )
                    }
                  />
                  <input
                    type="time"
                    className="rounded-md border border-neutral-300 px-2 py-1 text-sm disabled:opacity-40"
                    value={entry.closes}
                    disabled={entry.closed}
                    onChange={(event) =>
                      setHours((current) =>
                        current.map((row, position) => (position === index ? { ...row, closes: event.target.value } : row)),
                      )
                    }
                  />
                  <label className="flex items-center gap-1 text-xs text-neutral-600">
                    <input
                      type="checkbox"
                      checked={entry.closed}
                      onChange={(event) =>
                        setHours((current) =>
                          current.map((row, position) =>
                            position === index ? { ...row, closed: event.target.checked } : row,
                          ),
                        )
                      }
                    />
                    Closed
                  </label>
                </div>
              ))}
            </div>
          </div>

          <StepNav
            onBack={() => setStepIndex(3)}
            onNext={handleSavePresence}
            nextLabel={busy ? 'Saving…' : 'Continue'}
            busy={busy}
          />
        </div>
      )}

      {step.key === 'proof' && (
        <div className="mt-8 grid gap-6 rounded-lg border border-neutral-200 bg-white p-6">
          <div className="grid gap-3">
            <Field label="Review text">
              <textarea
                className={inputClass}
                rows={3}
                value={testimonialDraft.quote}
                onChange={(event) => setTestimonialDraft((current) => ({ ...current, quote: event.target.value }))}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Customer name">
                <input
                  className={inputClass}
                  value={testimonialDraft.author}
                  onChange={(event) => setTestimonialDraft((current) => ({ ...current, author: event.target.value }))}
                />
              </Field>
              <Field label="Source" hint="Google, Facebook, e-mail…">
                <input
                  className={inputClass}
                  value={testimonialDraft.source}
                  onChange={(event) => setTestimonialDraft((current) => ({ ...current, source: event.target.value }))}
                />
              </Field>
            </div>
            <button
              type="button"
              className={secondaryButton}
              disabled={!testimonialDraft.quote || !testimonialDraft.author}
              onClick={() => {
                setTestimonials((current) => [...current, testimonialDraft])
                setTestimonialDraft({ quote: '', author: '', source: '' })
              }}
            >
              Add review
            </button>
          </div>

          {testimonials.length > 0 && (
            <ul className="grid gap-2 text-sm text-neutral-600">
              {testimonials.map((testimonial, index) => (
                <li key={index} className="rounded border border-neutral-200 p-3">
                  “{testimonial.quote}” — {testimonial.author}
                </li>
              ))}
            </ul>
          )}

          <p className="text-xs text-neutral-500">
            No reviews yet? The reviews section is simply left out. Nothing is fabricated.
          </p>

          <StepNav
            onBack={() => setStepIndex(4)}
            onNext={handleFinish}
            nextLabel={busy ? 'Starting…' : 'Build my website'}
            busy={busy}
          />
        </div>
      )}
    </div>
  )
}

const inputClass = 'mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm'
const primaryButton = 'rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40'
const secondaryButton = 'rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:opacity-40'

function Field({ label, hint, children, voiceValue, onVoiceText }: { label: string; hint?: string; children: React.ReactNode; voiceValue?: string; onVoiceText?: (text: string) => void }) {
  return (
    <div className="text-sm font-medium"><label className="block">
      {label}
      {hint && <span className="ml-2 text-xs font-normal text-neutral-500">{hint}</span>}
      {children}
    </label>{onVoiceText && <IntakeVoice label={label} value={voiceValue ?? ''} onChange={onVoiceText} />}</div>
  )
}

function StepNav({
  onBack,
  onNext,
  nextLabel,
  busy,
  onSkip,
}: {
  onBack: () => void
  onNext: () => void
  nextLabel: string
  onSkip?: () => void
  busy: boolean
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <button type="button" className={secondaryButton} onClick={onBack} disabled={busy}>
        Back
      </button>
      {onSkip && <button type="button" className={secondaryButton} onClick={onSkip} disabled={busy}>Skip for now</button>}
      <button type="button" className={primaryButton} onClick={onNext} disabled={busy}>
        {nextLabel}
      </button>
    </div>
  )
}
