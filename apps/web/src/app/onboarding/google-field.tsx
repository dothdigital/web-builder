'use client'

const guides = {
  business: { title: 'Google Business Profile URL', description: 'Find your business listing in Google Maps. Open the listing, choose Share, then Copy link. Paste the public listing link here, rather than a profile-management page.', url: 'https://www.google.com/maps', link: 'Find your business on Google Maps', help: 'https://support.google.com/maps/answer/11471036' },
  maps: { title: 'Google Maps URL', description: 'Open your location in Google Maps, choose Share (or Share or embed map), then Copy link. Paste the link here, rather than the embed HTML.', url: 'https://www.google.com/maps', link: 'Open Google Maps', help: 'https://support.google.com/maps/answer/11471036' },
  place: { title: 'Google Place ID', description: 'Use Google’s Place ID Finder to search for your business name or address. Select the correct result and copy its Place ID. This is different from your Business Profile ID.', url: 'https://developers.google.com/maps/documentation/javascript/examples/places-placeid-finder', link: 'Open Place ID Finder', help: 'https://developers.google.com/maps/documentation/places/web-service/place-id' },
  analytics: { title: 'GA4 measurement ID', description: 'In Google Analytics, select the correct property. Open Admin → Data collection and modification → Data streams, then select your website’s web stream. Copy the Measurement ID beginning with G-.', url: 'https://analytics.google.com/', link: 'Open Google Analytics', help: 'https://support.google.com/analytics/answer/9539598' },
  tagManager: { title: 'GTM container ID', description: 'Open Google Tag Manager and select your account and web container. In Workspace, copy the container ID beginning with GTM- near the top. Paste only the ID, not the installation code.', url: 'https://tagmanager.google.com/', link: 'Open Google Tag Manager', help: 'https://support.google.com/tagmanager/answer/14847097' },
  verification: { title: 'Search Console verification', description: 'In Google Search Console, add or select a URL-prefix property and choose HTML tag as the ownership verification method. Copy only the value inside content="…" from the google-site-verification meta tag. Paste it here, publish your website, then return to Search Console to verify. Domain properties use DNS verification instead.', url: 'https://search.google.com/search-console', link: 'Open Google Search Console', help: 'https://support.google.com/webmasters/answer/9008080' },
} as const

export function GoogleField({ kind, value, onChange, hint }: { kind: keyof typeof guides; value: string; onChange: (value: string) => void; hint?: string }) {
  const guide = guides[kind]
  const id = `google-${kind}`
  return <div className="relative">
    <div className="flex items-start gap-2">
      <label htmlFor={id} className="text-sm font-medium">{guide.title}{hint && <span className="ml-2 text-xs font-normal text-neutral-500">{hint}</span>}</label>
      <details className="shrink-0">
        <summary aria-label={`How to find ${guide.title}`} title={`How to find ${guide.title}`} className="flex h-5 w-5 cursor-pointer list-none items-center justify-center rounded-full border border-neutral-400 text-xs font-semibold text-neutral-600 focus-visible:outline-2 [&::-webkit-details-marker]:hidden">i</summary>
        <div className="absolute left-0 top-7 z-20 grid w-72 max-w-[85vw] gap-3 rounded-lg border border-neutral-200 bg-white p-4 text-sm font-normal text-neutral-700 shadow-lg">
          <p className="font-medium text-neutral-900">How to find it</p>
          <p>{guide.description}</p>
          <a href={guide.url} target="_blank" rel="noopener noreferrer" className="underline">{guide.link} ↗</a>
          <a href={guide.help} target="_blank" rel="noopener noreferrer" className="underline">Google’s official instructions ↗</a>
          <p className="text-xs text-neutral-500">You can leave this blank if you do not use this service.</p>
        </div>
      </details>
    </div>
    <input id={id} className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" value={value} onChange={event => onChange(event.target.value)} />
  </div>
}
