# Help center

The public `/support` hub and `/support/[slug]` articles live in
`apps/web/src/app/support`. Content is centralized in `guides.ts`; video metadata
and article associations are in `videos.ts`. CSS is scoped to the help center and
uses Webtummy's Plus Jakarta Sans, navy, purple and multicolour brand accents.

## Content and media

- 53 illustrated guides, organized into nine customer-facing collections.
- 39 WebP screenshots in `apps/web/public/support`.
- Six actual-browser WebM walkthroughs, English WebVTT captions, downloadable
  videos, and readable transcripts. Videos have no audio and do not autoplay.
- All screenshots and videos show the fictional Willow Studio site, owned by an
  ordinary customer with both platform admin and platform support flags false.
  The isolated documentation workspace has a complimentary billing exemption,
  so no real card, customer subscription, or paid AI generation is involved.
- No existing customer website is changed by capture. Browser automation blocks
  non-GET requests and makes demonstration edits only in the current browser.

## Refresh captures

Run from `/home/ubuntu/webtummy` with the repository's supported Node runtime:

```sh
/usr/local/bin/webtummy-node22 node_modules/tsx/dist/cli.mjs scripts/create-support-demo.mts
/usr/local/bin/webtummy-node22 node_modules/tsx/dist/cli.mjs scripts/capture-support.mts
/usr/local/bin/webtummy-node22 node_modules/tsx/dist/cli.mjs scripts/record-support-videos.mts
```

The fixture script creates only its named, isolated documentation account and
site. It records non-secret object IDs in `/tmp/webtummy-support-demo.json` with
mode 0600. Session tokens remain in memory, are short lived, and are never written
to public artifacts. Capture explicitly refuses platform staff accounts.
Capture uses the existing Playwright installation under `/tmp/webtummy-ui-check`
and browser libraries under `/tmp/webtummy-browser-libs`.

If a capture run fails, fix that state and regenerate the affected assets before
publishing. Keep `capture-manifest.json`, the video manifest, WebVTT captions,
and `video-transcripts.json` consistent with the generated media. Never use a
customer website or an administrator account as documentation example content.

## Validation and release

```sh
npm run typecheck -w @awb/web
SUPPORT_CHECK_BASE=http://127.0.0.1:3010 /usr/local/bin/webtummy-node22 node_modules/tsx/dist/cli.mjs scripts/validate-support.mts
```

Validation checks guide URLs and screenshots, search and filtering, screenshot
lightbox and Escape, video loading and seeking, caption tracks, responsive
layouts, and unknown-article handling. Release using `deploy/RELEASES.md`, building
in an isolated release and keeping the serving application running.
