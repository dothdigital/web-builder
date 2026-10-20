# Image editing

Image controls offer two separate entrypoints:

- **Crop** uses react-image-crop directly over the selected canvas image. Drag its edges, reset, cancel, or apply. The selected rectangle maps to original image pixels, including cover and contain fit.
- **Edit image** opens Filerobot in a large overlay above the website editor. Adjust (crop, rotate and horizontal/vertical flip), fine-tuning, filters, resize, and annotations are enabled. The sidebar only contains the launch buttons.

Both tools export PNG and use the existing authenticated `/api/assets` upload endpoint. Applying creates a separate asset and replaces only the current image URL in the draft. Original library assets, image descriptions, and other instances of the original are preserved. Save the website to persist its new selection. Cancellation creates no assets. An upload failure keeps the edits available for retry.

Background removal is intentionally excluded. Editing runs in the user's browser; the server handles normal asset reads, upload validation and storage. Tools are loaded only when opened. No external editing API, paid account, or AI job is used. Backend translation fetching is disabled. MIT/ISC notices are retained at `/image-editor-licenses.txt`.

Filerobot 4.9.1, react-konva 19.0.10 and Konva 9.3.6 are pinned. The Webpack alias makes Filerobot and react-konva share the browser Konva build and avoids a native node-canvas dependency during Next builds.

Verification scripts:

```sh
node_modules/.bin/tsx scripts/validate-image-crop-source.mts
UI_CHECK_BASE=http://127.0.0.1:3003 node_modules/.bin/tsx scripts/validate-image-edit-crop-browser.mts
```

Browser verification uses a temporary isolated workspace and synthetic image, and cleans up its records and files. It verifies inline crop and cancel, original preservation, popup export, upload retry, draft save/reload, discard and mobile layout.

## Release verification

Released as `image-edit-crop-20261019` on 2026-10-19. The production build, TypeScript checks, focused ESLint checks, source-coordinate checks, and authenticated desktop/mobile browser checks passed. The browser checks passed against both the candidate and the live site. They also verified that opening the popup does not silently crop the source, and that flips are baked into saved image pixels. Public health returned database up after activation.

Screenshots: [inline crop](screenshots/image-inline-crop.png), [desktop popup](screenshots/image-editor-popup-desktop.png), [mobile popup](screenshots/image-editor-popup-mobile.png).
