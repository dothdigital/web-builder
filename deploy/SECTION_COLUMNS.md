# Flexible sections with columns

Choose **Add section**, select **Columns for a blank section** (1–5), then
**Blank section — build without AI**. Properties shows a separate **Add content**
menu for every column. Each column can hold multiple headings, paragraphs,
images, buttons, forms, lists, quotes, social links, menus, dividers, spacers,
nested text columns, or HTML/embed objects.

Use **Equal column widths** and **Equal column heights** to control sizing.
On smaller containers columns adapt to two columns on tablets and a single
column on phones. Equal heights are released on phones to avoid large gaps
between stacked content.

Each object can move to another column or be copied to a selected column.
**Copy all objects from column N** appends independent copies to the selected
target column. Copies have fresh object IDs and preserve content, image
references, and object formatting. Images stay in the same project library;
copying does not request new AI images or duplicate stored image files.

Reducing the column count moves content into the last remaining column; it does
not delete content. Normal Undo, Redo, Save, test-link refresh and paid live
publication rules apply. Legacy manual sections keep their original layout and
can be converted with **Arrange this section into columns**. Designed/AI layouts
retain their own layout; the column builder is the flexible blank-section flow.

Validation:

```sh
npx tsx scripts/validate-section-columns.tsx
UI_CHECK_BASE=http://127.0.0.1:3002 npx tsx scripts/validate-section-columns-browser.mts
```

Browser verification creates and deletes an isolated workspace and image
fixture. It does not edit customer sites, publish a live site or queue AI jobs.

Select an image or empty image placeholder on the editor canvas to open image
controls in the top toolbar: **Upload from computer**, **Generate with AI**, or
**Choose from image library**. These controls use the same project library and
targeted AI replacement flow as Properties. They are editor-only.

The top toolbar and Properties image controls also include **Choose from icon library**.
Search 1,891 bundled Lucide icons, set color and size (16–256px), then select an icon.
Icons are stored as self-contained SVG image URLs, including the full Lucide/Feather
license. No external icon CDN, AI generation or asset upload is required.
They can be saved, copied and exported through the existing image-object flow.
Catalog source/version and license: `apps/web/src/lib/icons/README.md`.
Validation: `npx tsx scripts/validate-icon-library.tsx`.

Image options stay in the top toolbar, leaving the selected image and resize
handles unobstructed. The toolbar expands only while a library or AI form is open.
In **Generate with AI**, enable **Transparent background (PNG)** to request
a cutout. The worker explicitly requests transparent PNG output and checks real
alpha before storing/replacing the image. Opaque or empty results fail while
keeping the existing selection. PNG export preserves transparency.
Validation: `npx tsx scripts/validate-transparent-images.mts`.

**Add object** uses the selected section. Selecting a column or an object inside
it preselects that column in the dialog. The dialog shows both section and column
destinations and allows an explicit change before insertion. Selecting the shared
header/footer targets that shared component; **New blank section** is an explicit
choice. New objects are selected and revealed after insertion.
Regression validation: `npx tsx scripts/validate-add-object-selection.mts`.

## Blank pages

Open **+ Blog / Page → Blank page — design it yourself**. Enter a page name and
URL and optionally add it to navigation. This creates a CUSTOM page with no body
sections, keeps the shared header/footer, selects the new page and records the
change in normal editor history. Save persists the draft. No content or image
jobs are queued. The editor-only empty-state instructions do not render in
preview/export. Users can add sections/objects or undo creation normally.
Manual saving, test links and paid publishing accept blank pages; generated-site
validation continues to reject accidental empty pages.

## HTML / Embed editor

Select an HTML / Embed object and choose **Edit HTML** in the top toolbar or
Properties. Paste markup into **HTML code**. Optional CSS/JavaScript panels and
a content-height field are available. **Apply HTML** updates the selected draft
object; **Cancel** discards dialog edits. Save the website normally. Preview and
export execute the code inside the existing sandboxed iframe; the editing canvas
retains a selectable placeholder.
Regression: `npx tsx scripts/validate-html-object.mts`; browser verification includes
actual clipboard paste, CSS/JavaScript rendering and Save/reload.

## Copy page

Open the page picker and choose **Copy** next to a page, or use **Page → Copy
this page** in Properties. Choose a new name and URL and optionally add a menu
link. The copy has new page/section IDs and independent content/style/custom-code
objects, retains image references, and updates its canonical URL and section
anchor links. Shared header/footer stay shared. Cancel, Undo/Redo and normal Save
apply. No AI or asset-copy jobs are queued.
Validation: `npx tsx scripts/validate-copy-page.mts` (read-only database seed);
browser verification covers independent copied HTML edits, URL conflicts,
Undo/Redo, navigation and Save/reload.
