# Portfolio, credentials and optional design inspiration

In the editor, open **Sections → Add section**. Choose **Portfolio / products — add your work** or **Credentials / awards — upload badges**. These add an editable section immediately, without an AI request. Both are also available in the AI section catalogue.

Select the whole section, then use Properties to add entries. Each entry supports a local upload or an existing project image, accessible image description, text, optional link, ordering and deletion. Portfolio entries have categories and link text; credentials have issuer and year fields. Uploads use the existing authenticated project asset pipeline, including private-storage thumbnails.

Portfolio layouts are featured, grid and horizontal rail. Category filters are visible in Preview/export; the editor shows all entries so hidden categories do not prevent editing. Credentials offer grid, compact and horizontal layouts, with uncropped badge images. Empty showcases stay unpublished until entries are added. The generic editor background, card colour, typography, sizing and movement controls also apply. These sections can be added to any page of any project. A separate work/product detail page can be linked using an entry's page path.

AI must use supplied work, products and credentials. These components are excluded from automatic image generation to avoid invented product photos, client work or award badges. Users upload those images themselves. Existing websites are not regenerated or given fabricated examples.

## Reference intake

**Create website → Your business → Design inspiration (optional)** accepts one public page URL, layout/style/both, and notes. Leaving the URL blank preserves normal generation. It does not crawl the entire domain.

The initial background generation stage downloads bounded HTML, extracts headings, structural counts, layout hints and inline/embedded stylesheet cues, then passes these observations to AI design planning and composition. User branding and notes take priority. No screenshot or browser execution is used, so sites that depend entirely on JavaScript or block automated access may provide limited inspiration. External stylesheets, fonts, images, text and claims are not imported. This is an adaptation to the component catalogue, not a pixel-exact clone.

The reader allows only public HTTP(S) destinations, resolves and pins each connection, validates every redirect, rejects private addresses, limits response size and has a total request deadline. Script content is not sent to AI, and reference observations are treated as untrusted data. Failures produce a progress notice and generation continues from the brief and notes.

The additive `20260929000100_design_reference` migration stores `Project.designReference` and `Project.designReferenceObservation`. Apply migrations and regenerate Prisma when deploying, then restart production web/worker processes. No new environment variables are needed.

## Validation

- `node --import tsx scripts/validate-showcases.mts`: registry/rendering, category scopes, empty states, responsive rules, actual ZIP image bundling and internal links.
- `node --import tsx scripts/validate-showcase-editor.mts`: real inspector controls in jsdom; entry editing, library thumbnails, uploads (mocked), ordering and deletion.
- `node --import tsx scripts/validate-design-reference.mts`: URL/address checks, extraction, inspiration modes, fallback and mocked OpenAI prompt wiring.

Full live AI generation is not part of these checks and incurs normal provider usage. The public Kinex homepage was separately read successfully using the reference reader.
