# AI Website Builder

Monorepo implementing the SOW: a user describes their business, a background worker generates a
unique, art-directed website as a validated **Website Model**, and a canvas editor lets a
non-technical user change anything without code.

```
apps/web                Next.js app (onboarding, progress, editor, preview, tenant renderer)
apps/worker             BullMQ worker running the generation pipeline
packages/website-model  Zod schema + validation for the Website Model (source of truth)
packages/component-registry  Safe React section components, props schemas, editor fields
packages/ai             Provider interface, model routing, deterministic stub provider
packages/pipeline       Staged generation pipeline (analyze → … → validate)
packages/database       Prisma schema, migrations, seed
packages/seo            Metadata, sitemap, robots, JSON-LD
packages/shared         Env, storage (S3 + local), colour utilities
```

## Prerequisites

- Node.js 20+ (developed on 22/24)
- PostgreSQL 15+
- Redis (optional — see `USE_REDIS_QUEUE`)

`docker-compose.yml` provides both: `docker compose up -d`.

## Setup

```bash
cp .env.example .env          # edit DATABASE_URL if you are not using docker compose
npm install
npm run db:migrate
npm run db:seed               # demo@example.com / workspace "Demo Studio"
npm run dev -w @awb/web       # http://localhost:3000
```

Sign in at `/signin` with any email (development credentials provider; the first sign-in creates the
user and a personal workspace). The seeded account is `demo@example.com`.

### Background worker

Generation always runs as a job. With Redis available:

```bash
npm run dev -w @awb/worker    # consumes the "website-generation" queue
```

Without Redis, set `USE_REDIS_QUEUE=false` and the same pipeline runs detached in the web process —
identical stages, identical progress events, no worker to run.

Progress is persisted per stage in `generation_jobs` and streamed to the browser over SSE at
`/api/projects/{id}/progress`, so the user sees each stage, retries and failures live.

## AI

`AI_PROVIDER=stub` (default) runs a deterministic generator: no API key, no network, reproducible
websites — different briefs still produce different layouts, palettes and copy.

Set `AI_PROVIDER=openai` and `OPENAI_API_KEY` to use OpenAI. Per-task model routing lives in
`packages/ai/src/models.ts` with the requested defaults (planning/copy/JSON → GPT-5.6 Sol, rewrites
and editor commands → Terra/Luna, images → GPT-Image-2) plus fallback chains, so model changes are
configuration, not code changes. The exact model IDs have not been validated against a live account.

## Assets

S3 is used when `S3_BUCKET` is set; otherwise files are written to `LOCAL_UPLOAD_DIR` (default
`.uploads` at the repo root) and served from `/uploads/<key>`. Uploads and AI images both create
`Asset` rows scoped to the workspace and project.

## Editor

Open a project from `/dashboard` → **Edit**.

- Click any section on the canvas to select it; header and footer are selectable too (left rail → Global).
- Type directly on the canvas to edit text — it writes back to the exact field in the Website Model.
- Drag the section handle (or a row in the left rail) to reorder; the blue line shows the drop position.
- Hover between sections and press **+** to insert a section at that point.
- Duplicate, delete, hide/show from the section toolbar.
- Inspector (right): text, rich text, images with upload, links, selects, numbers, repeaters/lists.
- Layout variant dropdown swaps to another component in the same family, keeping compatible content.
- **Page** tab edits title, H1 and SEO; **Theme** tab edits palette, typography, radius, spacing.
- Desktop / tablet / mobile preview widths.
- Undo/redo (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z) and save (Ctrl/Cmd+S).
- "Ask AI" applies a section-scoped patch; the result is validated against the component schema
  before it is accepted.

Every save writes a new immutable `WebsiteVersion`, so earlier versions stay restorable. The model is
validated (Zod + cross-page checks) and every section's props are validated against its registry
schema before persistence — unknown components and invalid props are rejected, never rendered.

## Static export

**Export HTML** in the editor toolbar (or `GET /api/projects/<id>/export`) downloads the approved
site as a zip:

```
index.html, <page>/index.html   one static page per Website Model page
assets/site.css                 design tokens as CSS variables
assets/images/*                 every referenced image, rewritten to relative paths
sitemap.xml, robots.txt, llms.txt, README.txt
```

Each page carries `<title>`, meta description, canonical, Open Graph/Twitter tags, `noindex` when
the page is excluded, LocalBusiness + FAQ JSON-LD, the Google Search Console verification tag and
the GA4 snippet when those are configured. The latest `PUBLISHED` version is exported; add
`?source=draft` to export the working draft instead. The zip opens directly from disk — no server
required.

## SEO, social and Google details

Onboarding step 4 collects social profile URLs, phone/email/WhatsApp, address, opening hours,
Google Business Profile and Maps URLs, Place ID, Search Console verification, GA4 and GTM IDs.
These are stored per project and copied into the Website Model — the AI never invents them. Each
page gets exactly one H1 plus a descriptive H2 per section, and an AI-written SEO title,
description and canonical, all editable in the editor's **Page** tab.

## Commands

```bash
npm run typecheck
npm run lint
npm run build
npm run db:studio
```
