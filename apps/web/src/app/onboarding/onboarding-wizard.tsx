'use client'
import { ErrorNotice } from '@/components/error-notice'
import { LayoutGallery } from '@/components/account/layout-gallery'
import { layoutCatalogue } from '@awb/shared/layout-catalogue'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DesignTokens } from '@awb/website-model'
import { designReferenceSchema } from '@awb/shared/design-reference'
import {
  createProjectFromBrief,
  saveBrandColors,
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
  { key: 'images', title: 'Images', help: 'Upload your own photography, or let the image model create artwork for the empty slots.' },
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

const homepageSectionOptions = ['About us / Who we are', 'Service areas', 'Our methodology / Approach', 'Why choose us'] as const

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

export function OnboardingWizard() {
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
  const [referenceUrl, setReferenceUrl] = useState('')
  const [referenceMode, setReferenceMode] = useState<'layout' | 'style' | 'both'>('both')
  const [referenceNotes, setReferenceNotes] = useState('')
  const [industry, setIndustry] = useState('')
  const [city, setCity] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [tone, setTone] = useState('')
  const [primaryConversion, setPrimaryConversion] = useState<'CALL' | 'WHATSAPP' | 'FORM' | 'BOOKING_URL' | 'QUOTE'>('FORM')
  const [services, setServices] = useState<string[]>([''])

  const [logoColors, setLogoColors] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<PaletteSuggestion[]>([])
  const [selectedPalette, setSelectedPalette] = useState<DesignTokens>()
  const [logoPreview, setLogoPreview] = useState<string>()
  const [localLogoPreview, setLocalLogoPreview] = useState<string>()
  const logoInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      if (localLogoPreview) URL.revokeObjectURL(localLogoPreview)
    }
  }, [localLogoPreview])

  const [imageMode, setImageMode] = useState<'upload' | 'generate' | 'mixed'>('generate')
  const [uploadedImages, setUploadedImages] = useState<string[]>([])

  const [socials, setSocials] = useState<Record<string, string>>({})
  const [googleBusinessUrl, setGoogleBusinessUrl] = useState('')
  const [googleMapsUrl, setGoogleMapsUrl] = useState('')
  const [googlePlaceId, setGooglePlaceId] = useState('')
  const [ga4MeasurementId, setGa4MeasurementId] = useState('')
  const [gtmContainerId, setGtmContainerId] = useState('')
  const [googleVerification, setGoogleVerification] = useState('')
  const [addressLine1, setAddressLine1] = useState('')
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
      const reference = referenceUrl.trim() ? designReferenceSchema.safeParse({ url: referenceUrl, mode: referenceMode, notes: referenceNotes }) : undefined
      if (reference && !reference.success) throw new Error(reference.error.issues[0]?.message || 'Check the reference website address')
      const { projectId: created } = await createProjectFromBrief({
        templateId,
        businessName,
        homepageLength,
        homepageSections,
        description,
        ...(reference?.success ? { designReference: reference.data } : {}),
        industry,
        city,
        phone,
        email,
        tone,
        primaryConversion,
        services: services.map((service) => service.trim()).filter(Boolean),
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

    try {
      for (const file of Array.from(fileList)) {
        const body = new FormData()
        body.set('projectId', projectId)
        body.set('kind', 'IMAGE')
        body.set('file', file)
        const response = await fetch('/api/assets', { method: 'POST', body })
        const payload = (await response.json()) as { asset?: { url: string } }

        if (payload.asset) {
          setUploadedImages((current) => [...current, payload.asset!.url])
        }
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Image upload failed')
    } finally {
      setBusy(false)
    }
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
      }

      const { correlationId } = await startGeneration(projectId)
      router.push(`/projects/${projectId}/progress?correlationId=${correlationId}`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not start generation')
      setBusy(false)
    }
  }

  if (!layoutChosen) return <LayoutGallery onSelect={id => { setTemplateId(id); setLayoutChosen(true); setError(undefined) }} />

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      {!projectId && <div className="wt-notice mb-6 flex flex-wrap items-center justify-between gap-3"><span>Selected layout: <strong>{layoutCatalogue.find(layout => layout.id === templateId)?.name || 'Custom design'}</strong></span><button type="button" className="wt-button secondary" disabled={busy} onClick={() => setLayoutChosen(false)}>Change layout</button></div>}
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
          <Field label="What does the business do?" hint="A few sentences. This drives the whole site.">
            <textarea
              className={inputClass}
              rows={5}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Industry">
              <input className={inputClass} value={industry} onChange={(event) => setIndustry(event.target.value)} />
            </Field>
            <Field label="City or service area">
              <input className={inputClass} value={city} onChange={(event) => setCity(event.target.value)} />
            </Field>
            <Field label="Phone">
              <input className={inputClass} value={phone} onChange={(event) => setPhone(event.target.value)} />
            </Field>
            <Field label="Email">
              <input className={inputClass} value={email} onChange={(event) => setEmail(event.target.value)} />
            </Field>
            <Field label="Tone">
              <input
                className={inputClass}
                placeholder="warm, premium, direct"
                value={tone}
                onChange={(event) => setTone(event.target.value)}
              />
            </Field>
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
            <p className="text-sm text-neutral-500">Have a website you like? Add its address. No reference is needed—we can create a design from your business brief.</p>
            <label className="grid gap-1 text-sm">Reference website<input className={inputClass} value={referenceUrl} onChange={event => setReferenceUrl(event.target.value)} placeholder="https://www.example.com" autoComplete="url" /></label>
            {referenceUrl.trim() && <>
              <label className="grid gap-1 text-sm">What should inspire your design?<select className={inputClass} value={referenceMode} onChange={event => setReferenceMode(event.target.value as typeof referenceMode)}><option value="both">Layout and visual style</option><option value="layout">Layout and section arrangement</option><option value="style">Visual style, colours and typography</option></select></label>
              <label className="grid gap-1 text-sm">What do you like—or want changed?<textarea className={inputClass} rows={3} maxLength={1500} value={referenceNotes} onChange={event => setReferenceNotes(event.target.value)} placeholder="For example: large project images and a badge wall, but use my brand colours and a simpler menu." /></label>
              <p className="text-xs text-neutral-500">We use the readable page structure as inspiration, with original text and images for your business. Your uploaded branding takes priority. Some sites block access; if that happens, we continue with your brief and these notes.</p>
              <button type="button" className="text-left text-xs underline" onClick={() => setReferenceUrl('')}>Skip reference—let AI choose</button>
            </>}
          </fieldset>
          <Field label="Services">
            <div className="grid gap-2">
              {services.map((service, index) => (
                <input
                  key={index}
                  className={inputClass}
                  value={service}
                  placeholder={`Service ${index + 1}`}
                  onChange={(event) =>
                    setServices((current) => current.map((entry, position) => (position === index ? event.target.value : entry)))
                  }
                />
              ))}
              <button type="button" className={secondaryButton} onClick={() => setServices((current) => [...current, ''])}>
                Add another service
              </button>
            </div>
          </Field>
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
            <button type="button" className="wt-button w-fit disabled:opacity-50" disabled={busy} onClick={() => logoInput.current?.click()}>
              {busy ? 'Uploading logo…' : logoPreview ? 'Replace logo' : 'Upload logo'}
            </button>
            <input
              ref={logoInput}
              aria-label="Choose logo file"
              type="file"
              accept="image/*"
              className="hidden"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) void handleLogoUpload(file)
              }}
            />
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
              <p className="text-sm font-medium">Suggested palettes</p>
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
                    {Object.values(suggestion.tokens.palette)
                      .slice(0, 6)
                      .map((color, index) => (
                        <span key={index} className="h-6 w-6 rounded" style={{ background: color }} />
                      ))}
                  </span>
                </button>
              ))}
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
            nextLabel={logoPreview ? 'Continue' : 'Skip — no logo yet'}
            busy={busy}
          />
        </div>
      )}

      {step.key === 'images' && (
        <div className="mt-8 grid gap-6 rounded-lg border border-neutral-200 bg-white p-6">
          <div className="grid gap-2">
            {(
              [
                ['upload', 'I will upload my own photos'],
                ['generate', 'Generate images for me'],
                ['mixed', 'Mix: use my photos, generate the rest'],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="imageMode"
                  checked={imageMode === value}
                  onChange={() => setImageMode(value)}
                />
                {label}
              </label>
            ))}
          </div>

          {imageMode !== 'generate' && (
            <Field label="Upload images" hint="JPG, PNG or WebP. You can add more later in the editor.">
              <input
                type="file"
                accept="image/*"
                multiple
                className="text-sm"
                onChange={(event) => {
                  if (event.target.files) void handleImageUpload(event.target.files)
                }}
              />
            </Field>
          )}

          {uploadedImages.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {uploadedImages.map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={url} src={url} alt="Uploaded" className="h-20 w-20 rounded object-cover" />
              ))}
            </div>
          )}

          <StepNav onBack={() => setStepIndex(1)} onNext={() => setStepIndex(3)} nextLabel="Continue" busy={busy} />
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
            <Field label="Google Business Profile URL">
              <input className={inputClass} value={googleBusinessUrl} onChange={(event) => setGoogleBusinessUrl(event.target.value)} />
            </Field>
            <Field label="Google Maps URL">
              <input className={inputClass} value={googleMapsUrl} onChange={(event) => setGoogleMapsUrl(event.target.value)} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Google Place ID" hint="Optional">
                <input className={inputClass} value={googlePlaceId} onChange={(event) => setGooglePlaceId(event.target.value)} />
              </Field>
              <Field label="GA4 measurement ID" hint="G-XXXXXXX">
                <input className={inputClass} value={ga4MeasurementId} onChange={(event) => setGa4MeasurementId(event.target.value)} />
              </Field>
              <Field label="GTM container ID" hint="GTM-XXXXXX">
                <input className={inputClass} value={gtmContainerId} onChange={(event) => setGtmContainerId(event.target.value)} />
              </Field>
              <Field label="Search Console verification" hint="Meta tag content value">
                <input className={inputClass} value={googleVerification} onChange={(event) => setGoogleVerification(event.target.value)} />
              </Field>
            </div>
          </div>

          <div className="grid gap-3">
            <p className="text-sm font-medium">Address and opening hours</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Street address">
                <input className={inputClass} value={addressLine1} onChange={(event) => setAddressLine1(event.target.value)} />
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

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      {hint && <span className="ml-2 text-xs font-normal text-neutral-500">{hint}</span>}
      {children}
    </label>
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
