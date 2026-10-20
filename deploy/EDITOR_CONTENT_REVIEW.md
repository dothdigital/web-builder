# Review images and content

Open a website in the editor and choose **Review images & content** in the workspace
bar, or **Review** in Properties. The review covers visible sections on every
page plus the shared site header and footer.

- **Empty fields & images that failed to load** lists empty positions and images
  whose thumbnails failed during this review. Empty fields can be optional.
- **All images** shows thumbnails for checking and replacing existing images.
- **All images & content** also lists editable headings and text.

Choose a page to narrow the list. **Add image** and **Review / replace image**
open that exact field's existing library, upload and AI generation controls.
**Add content** and **Edit content** open its text control. Use **Review** again
to continue checking. Normal Undo, Redo and Save apply to these changes.

Reviewing does not alter saved content. Save keeps the draft and uses the normal
test-link refresh queue when one exists. Live publication remains a separate
action and retains the active paid subscription requirement. The panel does not
queue AI generation or publish automatically.

The review uses effective section media so an inherited service image is not
incorrectly reported as missing. Hidden sections, removed elements, inactive
decorative backgrounds, and irrelevant defaults on manual objects are excluded.
The image failure status reflects thumbnails actually checked in the browser;
use All images to inspect existing image placements.

Validation:

```sh
npx tsx scripts/validate-editor-content-review.mts
UI_CHECK_BASE=http://127.0.0.1:3003 npx tsx scripts/validate-editor-review-browser.mts
```

The browser check creates and deletes an isolated temporary workspace and local
image fixture. It checks navigation across pages, missing image controls, image
library selection, image decoding, inherited-image AI targeting with the request intercepted, Undo, text editing, Save/reload, failed images,
and the review sidebar layout. It does not alter customer websites or generate
paid AI images.
