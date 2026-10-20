# Image completeness checks

Public native components must never render editor image placeholders. Optional
media must use a text layout when absent, including About splits and alternating
service sections. Empty gallery tiles are omitted; original editor pointers are
preserved. Editor image placeholders remain available for adding images.

The static exporter checks every rendered HTML image against archive entries
before returning an archive, including images added by linked cards and templates.
Unbundled or empty image sources abort the export before hosting upload or route
activation. Image files must have decodable dimensions even when they are too
small to need optimization.

Regression checks:

```sh
npx tsx scripts/validate-image-completeness.tsx
npx tsx scripts/validate-image-decoding.mts
```

Read-only audit of deployed snapshot fields:

```sh
npx tsx scripts/audit-image-gaps.mts
```

Empty optional fields are audit candidates, not proof of a failed network request.
The image generation allowance is separate from visual completeness: when a
section has no image, its public layout must not reserve an empty image panel.
Already deployed static files require a new release to use updated rendering.
Never publish a newer unsaved/unpublished draft as part of a historical-site audit.
