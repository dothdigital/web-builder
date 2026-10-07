# Local template integration testing

The integration contains 18 selectable layouts from the uploaded Insurigo and
Finbiz themes, screenshot thumbnails, sandboxed full-page previews, and 279
editable section definitions. Selected templates retain their section order,
header, footer and theme assets during generation and static export. Unsupported
proof sections remain hidden; nested demo logos, review widgets, awards and staff
images are removed from generated sections. Original sample previews retain the
uploaded theme content.

Production activation and worker restarts are intentionally excluded. Test on a
local checkout before requesting deployment.

## Local setup

Use a local `.env` with a local PostgreSQL database and the existing application
settings. To avoid paid AI calls, set `AI_PROVIDER=stub`. Use an empty `S3_BUCKET`
and `LOCAL_UPLOAD_DIR=.uploads` for local image storage. Set
`USE_REDIS_QUEUE=false` to run generation inline during local testing.

```sh
npm ci
npm run db:generate
npm run db:deploy
npm run dev -w @awb/web
```

Sign in with a local account that has generation access, open onboarding, choose
a layout, and complete intake. Check the saved project, editor and exported ZIP.
The additive migration adds `Project.templateId`; existing projects continue
using their original generation path.

## Automated checks

Run from the repository root with the local database configured:

```sh
npm run typecheck -w @awb/component-registry -w @awb/ai -w @awb/pipeline -w @awb/web
npm run lint -w @awb/web -- src/components/account/layout-gallery.tsx src/app/onboarding/onboarding-wizard.tsx src/app/actions/projects.ts src/lib/static-export.tsx
npx tsx scripts/validate-imported-layouts.cjs
node scripts/validate-layout-browser.cjs
```

The generation test forces stub AI and local storage, creates a uniquely named
disposable workspace, runs all 18 layouts through `runGeneration`, checks six
pages per layout, and removes its database records in `finally`. Test images,
models, screenshots and reports remain in `/tmp/webtummy-layout-validation`.
`--reuse-models` repeats rendering, editor-field and export checks against those
saved models without creating database records or regenerating images.

Browser checks require Playwright with Chromium. They use an installed
`playwright` package or `PLAYWRIGHT_MODULE`, and optionally `CHROMIUM_PATH`.
On this workspace the existing tooling under `/tmp/webtummy-layout-preview`
and cached Chromium are detected automatically. Port 3010 must be free.

Automation covers the actual gallery and registry renderers in an isolated
browser fixture: all previews and selection callbacks, category filters,
desktop/mobile rendering at 1440/390 pixels, text/image/link edits, local image
loading, one rendered H1, and CSS isolation. It also checks static-export HTML,
nested-page asset paths, CSS images/fonts, form markup and template section order.
Authenticated onboarding submission and the complete editor interface should be
smoke-tested manually. Paid-provider output has not been exercised.

## Recompiling imported themes

```sh
node scripts/import-layouts.cjs
```

The compiler rewrites and scopes CSS URLs/selectors, preserves body variants,
namespaces animation names, removes missing background references, and compiles
safe editable trees. Re-run the automated checks after changing it.
