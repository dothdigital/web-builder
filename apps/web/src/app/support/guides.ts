export type Guide = { slug: string; category: string; title: string; description: string; steps: [string, string][]; image: string; tip?: string; result: string }
export const categories = [
 { id: 'start', label: 'Dashboard & getting started', icon: '01', description: 'Find your websites, create a first draft, and understand your workspace.' },
 { id: 'pages', label: 'Pages & blog posts', icon: '02', description: 'Add pages, write blog posts, and manage page settings and SEO.' },
 { id: 'sections', label: 'Sections & layouts', icon: '03', description: 'Build your page structure, choose layouts, and arrange sections.' },
 { id: 'objects', label: 'Select & edit components', icon: '04', description: 'Master the floating toolbar, text, buttons, spacing, and object selection.' },
 { id: 'images', label: 'Images & brand design', icon: '05', description: 'Upload photos, generate images, resize them, and set your brand style.' },
 { id: 'ai', label: 'AI tools & content', icon: '06', description: 'Give AI clear instructions and review generated changes.' },
 { id: 'integrations', label: 'Forms, SEO & integrations', icon: '07', description: 'Configure forms, search visibility, analytics, and custom scripts.' },
 { id: 'publish', label: 'Preview, publish & measure', icon: '08', description: 'Share drafts, connect a domain, publish, and read visitor reports.' },
 { id: 'account', label: 'Account & troubleshooting', icon: '09', description: 'Manage your account and plan, and find help when something gets stuck.' },
] as const
const g = (slug: string, category: string, title: string, description: string, image: string, steps: [string,string][], result: string, tip?: string): Guide => ({slug,category,title,description,image,steps,result,tip})
export const guides: Guide[] = [
 g('dashboard','start','Find your way around the dashboard','Understand website cards, status labels, and the actions available for each website.','dashboard',[
 ['Open Websites','Sign in and choose Websites in the workspace navigation. Your website cards appear below the summary of website slots, published sites, and AI builds.'],
 ['Choose a website action','Use Open editor to make changes, Analytics to view reports, or Publish website / Manage domain to manage publishing. Click the website thumbnail to open its preview.'],
 ['Read the status','In development means the draft is available. Live indicates a deployed website. Building with AI means generation is running; use View progress when it is offered.'],
 ['Return here at any time','Use ← Websites in the editor, analytics, or publishing screen to return to your website list.']
 ],'You can identify the right website and open the tool you need.'),
 g('new-website','start','Create a website from your brief','Start a new website and give AI the information it needs.','new-website',[
 ['Choose New website','From Websites, use + New website. If your current plan has no free website slots, use Add website and complete the plan step first.'],
 ['Describe the business','Follow the onboarding questions. Provide accurate business information, services, audience, location, and the style you want. Add your own logo or photos when the form offers them.'],
 ['Review before generating','Check spelling, contact information, and claims. Submit the brief and follow the generation progress screen.'],
 ['Open the finished draft','Return to Websites when generation completes, then choose Open editor. Review every page before sharing or publishing.']
 ],'A generated draft is available for editing.','Creating a new website uses a website slot; adding a page inside an existing website does not create another website.'),
 g('editor-tour','start','Your editor, at a glance','Learn the top bar, left section list, canvas, and right properties panel.','editor-overview',[
 ['Start with the top bar','Choose the current page, open AI Assistant or + Blog / Page, switch desktop/tablet/mobile, undo or redo changes, preview, and save.'],
 ['Navigate with the left panel','Sections lists the sections on the current page and the global header/footer. Expand the elements of a selected section to find an individual component.'],
 ['Select on the canvas','Click a section or a specific object to edit it. Double-click editable text to type directly. The floating toolbar changes to suit the selected object.'],
 ['Use Properties on the right','Section edits the current selection; Page controls the current page and SEO; Theme changes site-wide design; Integrations contains tracking, indexing, forms protection, and scripts.']
 ],'You know where each kind of change belongs.'),
 g('workspace-panels','start','Show panels or focus the canvas','Give yourself more room without losing your place.','focus-canvas',[
 ['Use the workspace strip','Below the editor top bar, choose Sections or Properties to show or hide each side panel. The small collapse arrows inside the panels work too.'],
 ['Choose Focus canvas','Focus canvas hides both panels. Use the same control again to restore the panels, or open either panel individually.'],
 ['Check a smaller screen','Use Desktop, Tablet, or Mobile in the top bar to inspect the layout at different preview widths. Scroll inside the canvas to inspect the full page.']
 ],'Your workspace fits the task you are working on.'),
 g('switch-pages','pages','Switch between website pages','Find the correct page before changing its sections or content.','page-picker',[
 ['Open the page selector','Click the current page title in the top bar, or the page selector under Editing page in the left panel.'],
 ['Check both title and path','The picker shows each page title and its URL path. Choose the page you want to edit; its sections will replace the left-hand list.'],
 ['Use keyboard navigation','With the picker open, use Up/Down, Home/End, and Enter to choose. Escape closes the picker.']
 ],'The canvas and section list display the selected page.'),
 g('add-page','pages','Add a new website page','Create a page with its own topic, URL, content, and SEO settings.','create-page',[
 ['Open the creation form','Click + Blog / Page in the editor top bar. You can also open Page in Properties and choose + Create blog or page with AI.'],
 ['Select New website page','In Create, choose New website page. Enter Topic / working title and check the generated URL slug. Use a short, descriptive path.'],
 ['Write a useful brief','Fill in keywords, target audience, purpose, optional location, and Brief and verified facts. Select existing pages to link to, or leave them unchecked for AI to choose.'],
 ['Choose FAQs and a cover','Set Include AI-written FAQs. If you request a cover, describe both its subject and its visual style.'],
 ['Generate and review','Choose Generate content or Generate content and cover. Wait for the content-ready notification, review the draft, then select the new page in the page picker. Check its content and navigation links before publishing.']
 ],'The new content is available in your website draft.','New pages stay in the draft until you publish. Check your header or menu links so visitors can find the new page.'),
 g('add-blog','pages','Create a blog post and cover image','Generate a post, optional cover, and its blog listing.','create-blog',[
 ['Choose Blog post','Open + Blog / Page and keep Blog post + automatic listing selected.'],
 ['Set the topic and URL','Enter a specific topic, check the /blog/ slug, and provide primary and related keywords, the audience, and the desired action.'],
 ['Supply verified facts','Use the brief for facts, examples, and points to include. Choose internal pages for links and decide whether the post needs FAQs.'],
 ['Configure the optional cover','Check Add an AI-generated blog cover. Describe what it should show and the visual style; both image fields are required when a cover is requested.'],
 ['Review the generated draft','Generate the content. Use the notification when it is ready, inspect the post and blog listing, then save and publish when ready.'],
 ['Replace a cover later','Select the blog post and open Page properties. Expand Add or replace blog cover (or Add a blog cover). Generate a new cover, upload your own, or choose an image from the library. Set Cover image alt text, then Save.']
 ],'A blog post and its listing can be reviewed in the draft.'),
 g('page-settings','pages','Edit the page title and main heading','Change the current page’s identity and visible H1.','page-properties',[
 ['Select your page','Use the page picker to open the page you want to change.'],
 ['Open Page properties','Choose Page in the right-hand Properties panel. Scroll below Rewrite page with AI.'],
 ['Update the page title and H1','Edit Page title and H1. The H1 is the main page heading; the editor also updates the visible hero heading where supported.'],
 ['Check and save','Inspect the canvas and Preview, then Save. Check any navigation labels separately if they also need changing.']
 ],'The draft has the revised page title and H1.'),
 g('page-seo','pages','Set page SEO and search visibility','Edit search titles, descriptions, keywords, and canonical URLs.','page-seo',[
 ['Open the correct page','Select the page and choose Page in Properties. Scroll to Meta / SEO title.'],
 ['Write the search preview text','Set Meta / SEO title and Meta description so they accurately describe this page. Use the page topic naturally in its H1 and content too.'],
 ['Set keyword guidance and canonical','Enter Target keyword and comma-separated Secondary keywords. Review Canonical path; it identifies the preferred URL for this content.'],
 ['Choose indexing','Set Allow search engines to index this page. Also check the site-wide indexing switch in Integrations; page permission alone does not override site-wide blocking.'],
 ['Save and publish','Save the draft, then publish to update the live metadata. Preview pages remain non-indexable.']
 ],'The live SEO settings update after publishing.','Keywords guide content; the keywords meta tag itself does not improve Google rankings. Search engines decide when to recrawl and what to display.'),
 g('add-section','sections','Add a section with AI','Add a focused block to the current page without rebuilding it.','add-section',[
 ['Open Add section','Select the target page. Click + Add section on the left, or the + insertion control between canvas sections.'],
 ['Set the insertion point','Use the position selector to choose the top of the page or the section after which the new block should appear.'],
 ['Choose a topic','Keep AI chooses layout selected. Pick the section topic and add details. For Custom section, describe what you want in the required instructions.'],
 ['Generate the section','Choose Generate section, wait for completion, and review the inserted block. Adjust its content in Properties and Save.']
 ],'A new section appears at the selected position.'),
 g('choose-section-layout','sections','Choose a section layout yourself','Browse section families and start with a specific component.','section-layouts',[
 ['Open the section library','Click + Add section on the current page.'],
 ['Choose I choose layout','Switch from AI chooses layout to I choose layout. Browse available families such as Hero, Services, About, Gallery, Portfolio, Credentials, Reviews, FAQ, Contact, and CTA.'],
 ['Select a component','Choose the layout you want using its Generate button. Add any details and review the resulting section.'],
 ['Refine the layout','Select the section and use its properties to change the content, images, and available layout settings, then Save.']
 ],'The new section uses your chosen component family and layout.'),
 g('blank-section','sections','Build a blank section without AI','Create a custom section and add your own objects.','add-object',[
 ['Add a blank section','Open + Add section and choose + Blank section — build without AI.'],
 ['Add the first object','Use + Add object. Choose the blank section in Add to section, then choose a heading, paragraph, image, button, columns, or another object type.'],
 ['Edit and arrange','Select each object to update its content and appearance. Use spacing and layout controls to arrange the section, and add more objects as needed.'],
 ['Review responsive layouts','Check Desktop, Tablet, and Mobile. Save when the section looks right.']
 ],'You have a custom section built from your own objects.'),
 g('reorder-sections','sections','Reorder sections','Move whole sections while keeping their contents together.','section-properties',[
 ['Find the section','Open the correct page and find the section in the left-hand Sections list.'],
 ['Drag its handle','Drag the dotted reorder handle up or down to a new position. You can also focus the handle and use arrow keys; Escape cancels a drag.'],
 ['Use the canvas alternative','The section action strip on the canvas also offers Move up and Move down.'],
 ['Check the new flow','Read the page from top to bottom and Save.']
 ],'The section and its contents appear in the new order.'),
 g('hide-duplicate-delete-section','sections','Hide, duplicate, or delete a section','Manage whole sections using the section action strip.','section-properties',[
 ['Select the whole section','Choose the section from the left panel. If an object is selected, use Back to section properties in the right panel first.'],
 ['Hide without removing','Use Hide section on the canvas action strip or Hide this section in Properties. Turn it off again to restore visibility.'],
 ['Duplicate a section','Choose Duplicate on the section action strip, then edit the copy so its content and links are appropriate.'],
 ['Delete when needed','Use Delete on the section action strip or Delete section in Properties. Use Undo immediately if you remove the wrong section. Save the result.']
 ],'Your draft contains only the sections you want.','The object toolbar’s Delete object removes the selected object; the section controls operate on the whole section.'),
 g('section-properties','sections','Use the right-hand Section properties','Edit a section’s content, background, layout, and individual elements.','section-properties',[
 ['Select the section','Click the section’s entry on the left, then choose Section in the Properties panel.'],
 ['Change content fields','Edit the available headings, descriptions, lists, cards, buttons, and image fields. Fields vary by component. Expand repeatable items to edit their details.'],
 ['Adjust the background','Use Section background colour to change the whole section. Where offered, Use original background restores the template’s background.'],
 ['Select an individual element','Click an object on the canvas or in the element tree to show its controls. Use Back to section properties to return to the full section.'],
 ['Review and save','Check the canvas, then Save.']
 ],'The selected section reflects your content and design choices.'),
 g('layout-variant','sections','Change a section’s layout variant','Try another compatible component layout.','section-properties',[
 ['Select the section itself','Choose the section on the left. Use Back to section properties if a child element is selected.'],
 ['Find Layout variant','Where the section has compatible variants, choose a different entry in Layout variant. This control is only shown when alternatives are available.'],
 ['Review all fields','Check the resulting layout, content, and images. A different component may use different fields and can fall back to starter content when the existing content is incompatible.'],
 ['Keep or undo','Use Undo if the change is unsuitable. Otherwise finish editing and Save.']
 ],'The section uses the selected compatible variant.'),
 g('portfolio-credentials','sections','Add portfolios, products, awards, and badges','Showcase work or credentials with purpose-built sections.','add-section',[
 ['Choose the showcase type','Open + Add section and choose Portfolio / products — add your work or Credentials / awards — upload badges.'],
 ['Select the new section','Open its Section properties and expand each repeatable item.'],
 ['Add your content','Update titles, descriptions, images, image descriptions, and any link fields offered. Use your own verified project or credential details.'],
 ['Review the showcase','Check image cropping, links, and the mobile layout. Save and publish when ready.']
 ],'Visitors can browse your work or credentials.'),
 g('select-components','objects','Select components and use the element tree','Select the exact text, image, button, or container you want to change.','text-toolbar',[
 ['Click an object','Click directly on an editable object on the canvas. A selection outline and floating toolbar identify the current target.'],
 ['Use the element tree','Expand the selected section in the left panel. Choose a named child element to reach objects that are hard to click or overlap.'],
 ['Check the selected target','The right panel shows Editing and the selected element. Toolbar controls change for text, image, button, field, and block selections.'],
 ['Return to the whole section','Use Back to section properties in the right panel or select the section entry again.']
 ],'Your next change applies to the intended component.'),
 g('add-objects','objects','Add objects and components','Insert any of the 14 available object types without AI.','add-object',[
 ['Open Add object','Choose + Add object in the left panel.'],
 ['Choose a destination','Use Add to section to select an existing section or + New blank section.'],
 ['Choose an object type','Available choices are Form, Columns, Button, Divider, Heading, Paragraph, Image, Social, Menu, HTML / Embed, Bullets, Numbered list, Quote, and Spacer.'],
 ['Edit the inserted object','The object is selected after insertion. Use its Properties fields to set content and its floating toolbar to style and position it. Save after reviewing.']
 ],'The object is part of the selected section.','A section supports up to 100 added objects. If it becomes too crowded or too tall, add another blank section.'),
 g('edit-text','objects','Edit and format text','Change copy, fonts, size, emphasis, colour, and alignment.','text-toolbar',[
 ['Edit the words','Double-click editable text on the canvas and type, or use the corresponding content field in Properties. Click outside the text when finished.'],
 ['Use the text toolbar','Single-click the text to select it. Choose a font family, font size, Bold, Italic, or text colour.'],
 ['Set alignment','Choose left, centre, right, or justified text alignment. Use vertical alignment to place text at the top, middle, or bottom of its box.'],
 ['Check the result','Inspect long headings on mobile and tablet. Save your changes.']
 ],'Your text content and formatting are updated.'),
 g('buttons-links','objects','Edit buttons and text links','Set the label and destination for your calls to action.','button-link',[
 ['Select a button','Click the button on the editor canvas. Use Edit text / link in its floating toolbar to change its label and Link.'],
 ['Enter the destination','Use an internal path such as /contact, or a full external URL such as https://example.com. Check the destination in Preview.'],
 ['Link a text selection','For text, select the words to link and open the link control in the text toolbar. Set the destination and apply it.'],
 ['Style and save','Use the button’s colour, border, size, and spacing controls as needed, then Save.']
 ],'The button or linked text points to the intended destination.','Copied button objects have their links cleared; set the destination on a duplicated button before publishing.'),
 g('spacing','objects','Adjust padding and margins','Control space inside and around a selected component.','object-spacing',[
 ['Select the object','Click the text, button, image, or container you want to adjust.'],
 ['Open Spacing','Choose Spacing in the floating toolbar. You can also use the selected object’s spacing controls in Properties.'],
 ['Adjust the sides','Change padding to add space inside the object, and margins to add space around it. Use the available side controls to adjust individual edges.'],
 ['Check nearby objects','Inspect the surrounding layout and all preview widths. Use Undo if spacing pushes content out of place, then Save.']
 ],'The selected component has the intended breathing room.'),
 g('borders-backgrounds','objects','Change borders and background fills','Style an object without changing the whole section.','object-borders',[
 ['Select the component','Click the object you want to style.'],
 ['Set its border','Open Borders to choose border colour, width, style, and corner radius. These controls are offered for compatible non-image objects.'],
 ['Set the background fill','Use BG fill in the floating toolbar to change the object background. For the whole section’s colour, use Section background in Properties instead.'],
 ['Review contrast','Ensure the text is readable against the fill and Save.']
 ],'The object has its own border and background treatment.'),
 g('layout-columns','objects','Arrange components and columns','Control how items are arranged inside a selected container.','object-layout',[
 ['Select a container or compatible object','Use the canvas or element tree to select the layout box you want to adjust.'],
 ['Open Layout','Choose Layout in the floating toolbar. Available controls depend on the selected object and its container.'],
 ['Choose arrangement and gaps','Use Container arrangement and Space between items where offered to change columns and the gap between items.'],
 ['Inspect narrower previews','Check Tablet and Mobile, adjust if needed, and Save.']
 ],'The container arranges its items with your chosen layout.'),
 g('move-resize-layers','objects','Move, resize, and layer objects','Position components precisely within a section or move them to another section.','move-object',[
 ['Select and move','Use the selected object’s move handle to drag. Arrow keys move by 1 pixel; Shift + arrow keys move by 10 pixels when the movement control has focus.'],
 ['Resize the selection','Drag the blue edges or corners. Text corners change font size; block corners resize the box. Use Size for supported objects to enter width and height.'],
 ['Move between sections','Choose Move into section… and select Destination section. A whole-section selection offers Move section… instead.'],
 ['Arrange overlapping objects','Use Layers… to bring an object forward or to front, send it backward or to back, or reset its layer order.'],
 ['Review and save','Check that the object remains usable at all preview widths, then Save.']
 ],'Objects are placed and layered where you need them.'),
 g('multi-select','objects','Select multiple objects and group them','Edit compatible objects together inside one section.','multi-select',[
 ['Build a selection','Shift-click objects to add or remove them from the selection, or choose Select area and drag a rectangle around objects inside one section. Shift-drag is also supported.'],
 ['Use the group toolbar','When multiple objects are selected, use the floating toolbar to change compatible shared properties. Mixed properties may show automatic or mixed values. Use Align objects… to align left, centre, right, top, middle, or bottom edges where offered.'],
 ['Group or move together','Use Group when available to group the selection, or move the selected objects together. Use the toolbar’s ungroup control to release a group when offered.'],
 ['Review individual objects','Check text, images, and links after the change. Save when ready.']
 ],'You can work with several objects as one selection.','Multi-selection is scoped to objects in a single section.'),
 g('duplicate-delete-object','objects','Duplicate or remove a component','Copy an object or remove a selected element.','text-toolbar',[
 ['Select the exact object','Click the object or choose it from the element tree. Check its selection outline.'],
 ['Duplicate','Choose Duplicate object in the floating toolbar. Reposition the copy and edit its content. Re-enter button destinations, because copied button links are cleared.'],
 ['Delete or restore','Choose Delete object to remove the selection. Some elements also offer Remove this element / Restore this element in Properties.'],
 ['Recover a mistake','Use Undo immediately if you remove the wrong item. Review and Save.']
 ],'The section contains the objects you need.'),
 g('menus-social-embeds','objects','Add menus, social links, lists, and embeds','Configure the extra components available in Add object.','add-object',[
 ['Add the component','Use + Add object and choose Menu, Social, Bullets, Numbered list, Quote, Divider, Spacer, Columns, or HTML / Embed.'],
 ['Edit its Properties','Select the component and edit the fields offered. For menus and social components, set each label and destination. For lists, edit the individual lines or items.'],
 ['Configure advanced content','For HTML / Embed, enter the HTML and any supported CSS or JavaScript fields. Set the component height so the embedded content has room.'],
 ['Test the exported result','Custom scripts are disabled in the editor and authenticated preview. Test scripts on your published or exported website, then adjust as needed.']
 ],'The extra component has your own content and configuration.'),
 g('replace-image','images','Upload or replace an image','Use a file, your project image library, or an image URL.','replace-image',[
 ['Select the image','Click the image on the canvas and choose Replace image in the floating toolbar. You can also open the image field in Section properties.'],
 ['Choose a source','Use Upload from computer for your own file, or Choose from image library for an existing project image. Expand Use an image URL if you want to supply a URL.'],
 ['Choose the replacement','Select the file or library image and wait for it to load. A library selection updates the draft; use Save to keep the section change.'],
 ['Check the image description','Update the relevant accessibility / image description field so it describes the new picture. Check the crop and Save.']
 ],'Your selected image uses the new source.'),
 g('generate-image','images','Generate or update an image with AI','Create a replacement for one selected image.','ai-image',[
 ['Open the image controls','Click the image, choose Replace image, then Update with AI.'],
 ['Describe the image','Fill in What should the image show? Describe the subject, setting, composition, and details to include.'],
 ['Choose a direction','Select the available style directions, such as People and human moments or Local places and community. Use Custom direction for additional visual guidance.'],
 ['Generate and review','Choose Generate image with AI. Follow the progress notice and review the replacement when it is ready. Check its description and framing, and confirm the editor’s saved status.']
 ],'The requested image replacement is generated for the selected target.','AI-generated images are not a substitute for your own portrait, real team photos, or verified credentials. Upload those assets when authenticity matters.'),
 g('image-size','images','Resize images and choose fit or crop','Control image width, height, and how the picture fills its box.','image-size',[
 ['Select the image','Click the image and open Size in its floating toolbar.'],
 ['Set dimensions','Adjust Object width and Object height, or drag the blue selection handles. Full section width expands supported images to the width of the section.'],
 ['Choose the image fit','Fill / crop fills the available box and may trim edges. Fit whole image keeps the full picture visible and can leave space around it.'],
 ['Check important details','Inspect faces, text, and logos on Desktop, Tablet, and Mobile, then Save.']
 ],'The image fits its layout without losing important content.'),
 g('theme','images','Set site-wide colours and typography','Use Theme to create a consistent design across pages.','theme',[
 ['Open Theme','Choose Theme in the right-hand Properties panel.'],
 ['Set the colour palette','Adjust the available palette colours. Review headings, body text, backgrounds, and calls to action across several pages.'],
 ['Set typography and shape','Use the available typography, rounding, and spacing controls to refine the site-wide look.'],
 ['Set shared button colours','Use the global button background, text, and outline colours. Reset buttons to theme defaults removes those overrides.'],
 ['Review and save','Check contrast and all preview widths, then Save. Individual component styles can override global defaults.']
 ],'Pages share a consistent brand style.'),
 g('logo-header-footer','images','Change the logo, header, footer, and navigation','Edit the elements shared across your website.','theme',[
 ['Upload your logo','Open Theme and use the logo upload control. Review any palette suggestions before applying them.'],
 ['Select the global header or footer','Find the global components below the page sections in the left panel. Select the header or footer to open its Properties.'],
 ['Edit shared content','Update logo text or image, navigation labels and URLs, submenu links, contact details, social links, and calls to action where offered by the component.'],
 ['Adjust logo position','Select the logo in supported headers and use Logo position in header: original, left, centre, or right.'],
 ['Style the shared menu','Open Theme → Logo & navigation to set menu background, text colour, font, font size, bold/italic, and logo/menu alignment. Set Hamburger icon colour, or Use automatic contrast. Reset shared menu styling restores the shared defaults.'],
 ['Check multiple pages','The header and footer are global. Review more than one page, inspect the mobile menu, then Save.']
 ],'Shared branding and navigation are updated across the website.'),
 g('ai-assistant','ai','Use the page AI Assistant','Ask for focused changes to the current page or selection.','ai-assistant',[
 ['Choose the target','Open the correct page and optionally select the section or objects you want AI to change.'],
 ['Open AI Assistant','Use AI Assistant in the top bar or the floating button at the bottom of the editor.'],
 ['Write a specific instruction','Describe the change and what should stay the same. For example: “Shorten the selected heading to eight words and keep its meaning.”'],
 ['Send and review','Send the instruction and read the response or proposed changes. Follow any review/apply controls shown, inspect the canvas, and use Undo if needed. Save when satisfied.']
 ],'AI helps update the intended page or selection.'),
 g('assistant-add','ai','Use the assistant’s add menu','Find extra creation actions in the AI drawer.','assistant-add',[
 ['Open the AI drawer','Choose AI Assistant while editing the relevant page.'],
 ['Open the plus menu','Choose the + button labelled Assistant add menu.'],
 ['Choose the offered action','Select the creation or upload action you need. Complete the fields in the panel it opens.'],
 ['Review the result','Check the target page and generated content before saving or publishing.']
 ],'You can reach additional assistant actions from the drawer.'),
 g('rewrite-page','ai','Rewrite a page while keeping its layout','Improve copy and SEO without asking for a full rebuild.','page-properties',[
 ['Select the target page','Use the page picker and open Page in Properties.'],
 ['Write rewrite instructions','In Rewrite page with AI, fill in What would you like to change? Include tone, length, audience, and verified facts.'],
 ['Queue the rewrite','Choose Rewrite in background. You can keep working while the job runs.'],
 ['Review the notification','When the notification says the content is ready, review the result using the offered controls. The rewrite keeps the layout and images in place. Check accuracy before accepting and publishing.']
 ],'You have a rewritten page draft to review.'),
 g('section-ai','ai','Ask AI to improve a section','Make a smaller content change from Section properties.','section-properties',[
 ['Select the section','Choose the section in the left panel and open Section properties.'],
 ['Find its AI instructions','Scroll to the section’s Ask AI controls where offered.'],
 ['Describe the change','Give a focused instruction, such as making the heading more direct or rewriting the copy around a particular service.'],
 ['Submit and review','Queue the request and follow the content-ready notification. Review the section in context before saving or publishing.']
 ],'You can improve one section without requesting a whole-site rebuild.'),
 g('rerun-ai','ai','Rerun AI for content, images, or the whole website','Choose the scope of a larger update from the dashboard.','rerun-ai',[
 ['Save your editor changes','Rerun starts from the saved website. Save before leaving the editor.'],
 ['Open Rerun with AI','On the website’s dashboard card, choose Rerun with AI.'],
 ['Choose the update scope','Content only rewrites text and SEO while retaining design and images. Images only replaces up to 10 images. Full website rebuilds from the brief and instructions. Upload logo or photos uses supplied assets.'],
 ['Add instructions or uploads','Describe the requested change. For image-related options, choose the image direction. Upload logo/photos when appropriate; the form supports up to 10 photos, 5 MB per file.'],
 ['Generate and review','Submit, follow the progress screen, and inspect the new draft before publishing.']
 ],'The selected update runs with the scope you chose.','Images only updates up to 10 positions per run. Use the editor for precise replacements across a larger image library.'),
 g('background-jobs','ai','Follow generation progress and review ready content','Understand queued work, progress notices, and content-ready notifications.','dashboard',[
 ['Check the progress indicator','Website generation shows Building with AI and a progress link on the website card. Smaller content tasks show notifications in the editor or dashboard.'],
 ['Keep working while it runs','Background tasks can continue while you edit. Avoid submitting the same request repeatedly while it is queued.'],
 ['Review before applying','Open the ready notification and inspect the result using its review controls. Confirm the target page and the changes you want to keep.'],
 ['Handle a failed task','Read the error and any displayed error code. Retry a focused request when appropriate, or send the code and details to support.']
 ],'You can follow the job and review generated changes.'),
 g('contact-forms','integrations','Add and customize contact forms','Set field labels, types, required fields, and submission behaviour.','add-object',[
 ['Add or select a form','Use + Add object → Form, or select an existing supported Contact section. Open Section properties.'],
 ['Configure the fields','Use the form-field editor to set labels, field types, required status, and available choices. Adjust label styling and textarea rows where offered.'],
 ['Choose submission behaviour','For supported Contact sections, leave Custom submission URL blank to save leads in Webtummy, or enter an HTTPS form endpoint to submit to your provider. A custom endpoint must accept browser form submissions.'],
 ['Protect and test','Configure reCAPTCHA in Integrations if required. Save, publish, and submit a test on the live site to verify validation and delivery.']
 ],'The published form has the intended fields and submission destination.','Do not paste secret API keys into an embed, public script, or custom submission URL.'),
 g('site-seo','integrations','Set site indexing and Search Console verification','Control published search visibility and verification metadata.','integrations',[
 ['Open Integrations','Choose Integrations in the Properties panel. Find Site SEO.'],
 ['Choose site indexing','Set Allow search engines to index the published site. Also review indexing on individual pages under Page.'],
 ['Add the verification code','Paste the Google Search Console verification code in its field. Use the verification value requested for this site.'],
 ['Save and publish','Save, then publish. The published output updates robots.txt, sitemap.xml, llms.txt, and aillm.txt along with page metadata. Finish verification in Search Console.']
 ],'Your published site carries the selected visibility and verification settings.'),
 g('ga4','integrations','Add Google Analytics tracking','Install a GA4 measurement ID on the published website.','integrations',[
 ['Find your measurement ID','In Google Analytics, obtain the web data stream’s measurement ID beginning with G-.'],
 ['Enter the ID','Open Integrations in the editor and paste it in Google Analytics 4.'],
 ['Save and publish','Save the website and publish the updated output. Tracking runs on the exported website, rather than in the editor.'],
 ['Connect reports separately','To read Google reports inside Webtummy, open the website’s Analytics screen, choose Google Analytics, and follow the property connection controls. A measurement ID alone cannot read reports.']
 ],'The published website includes GA4 tracking.'),
 g('recaptcha','integrations','Protect forms with reCAPTCHA','Configure the reCAPTCHA v2 checkbox and its keys.','integrations',[
 ['Register the website domain','Create reCAPTCHA v2 checkbox keys for the domain on which the form will run.'],
 ['Enter the keys','Open Integrations → reCAPTCHA v2 checkbox. Enable Protect contact forms and enter Site key and Secret key.'],
 ['Save the integration','Choose Save reCAPTCHA settings. When a secret already exists, leave the secret field blank to keep it. The secret is stored encrypted on the server.'],
 ['Publish and test','Save relevant website changes, publish, and test a real form submission. Exported protected forms require the builder’s public form endpoint to remain available.']
 ],'The published contact form uses the configured spam protection.'),
 g('custom-scripts','integrations','Add global or page-specific scripts','Install supported custom HTML scripts in the right place.','integrations',[
 ['Choose the script scope','For every page, use Integrations → Global custom scripts. For one page only, select that page and use Page → Scripts for this page.'],
 ['Choose the position','Paste complete HTML script tags into Inside <head> or Before </body>, according to your provider’s instructions.'],
 ['Save and publish','Save the draft and publish a new output. Scripts do not execute in the editor or authenticated preview.'],
 ['Test the live website','Verify the widget or tracking on the published site. If it causes a problem, remove or correct the script and publish again.']
 ],'The script runs on the appropriate exported pages.'),
 g('save-undo','publish','Save changes and use undo or redo','Keep draft changes and recover recent edits.','editor-overview',[
 ['Save the draft','Choose Save in the top bar, or Ctrl+S / Cmd+S. Wait for Saving… to finish and the control to show Saved.'],
 ['Undo an edit','Use Undo, or Ctrl+Z / Cmd+Z. Use Redo or Ctrl+Shift+Z / Cmd+Shift+Z to restore an undone editor change.'],
 ['Check save failures','If saving reports an error, keep the tab open, read the message, and retry when the issue is resolved. Do not assume a failed save has been stored.'],
 ['Publish separately','Saving stores the draft and can queue a test-link refresh. Use Domains & Publish to update the live website.']
 ],'Your latest draft is saved.','Undo history belongs to the current editor session; do not rely on it as a permanent version archive.'),
 g('responsive-preview','publish','Preview desktop, tablet, and mobile','Review the full site before sharing it.','mobile-preview',[
 ['Switch preview widths','Use Desktop, Tablet, and Mobile in the editor top bar. Scroll through the full page at each width.'],
 ['Inspect the details','Check long headings, image crops, buttons, menus, forms, and any objects you have repositioned.'],
 ['Save before opening Preview','Save the draft, then choose Preview in the top bar. Preview opens the current page in a separate tab.'],
 ['Test navigation','Follow menu links and calls to action and check other pages. Custom scripts require testing in published or exported output.']
 ],'You have reviewed the draft at the main device sizes.'),
 g('test-link','publish','Share a test link for feedback','Let someone review the saved draft before launch.','dashboard',[
 ['Save your website','Use Save in the editor so the latest draft is available.'],
 ['Open the dashboard test-link control','Return to Websites and use the website card’s Test link control.'],
 ['Wait for the link to be ready','Follow the popup’s status. Copy the available address and open it to confirm it displays the expected draft.'],
 ['Share and refresh','Share the test link with your reviewer. Later saves can queue a background refresh; allow it to finish before asking someone to review new changes.']
 ],'Your reviewer can open the current deployed test version.','An authenticated Preview and a shareable test link serve different review needs. A test link is accessible to people who have its address.'),
 g('connect-domain','publish','Connect your domain','Add a domain and follow the DNS setup shown for your website.','publishing',[
 ['Open Domains & Publish','Save the draft. Use Domains & Publish in the editor or Publish website / Manage domain on the dashboard card.'],
 ['Add a hostname','Enter your domain in Add your domain. If offered, you can choose Use Webtummy address for now instead. Additional domains can redirect to your primary domain after publishing.'],
 ['Copy the displayed DNS records','At your domain provider, add the exact ownership TXT and routing records shown in Webtummy. Use the short Host when your provider automatically appends the domain. Keep existing email MX and TXT records.'],
 ['Check DNS and HTTPS','Choose Check DNS records. Add any additional HTTPS verification TXT records shown and allow time for DNS and certificate checks.'],
 ['Complete readiness checks','Follow the deployment steps and ensure ownership, routing, and HTTPS are ready before publishing.']
 ],'Your domain is verified and ready to serve the website.','Use the records shown in your own account. The example screenshot is not a source of DNS values.'),
 g('publish','publish','Publish your saved website','Launch or update the live website from your saved draft.','publishing',[
 ['Save and review','Save the editor and check the draft’s content, links, and responsive layouts.'],
 ['Open the publishing wizard','Choose Domains & Publish and review the selected primary domain or temporary Webtummy address.'],
 ['Complete the checks','Follow the DNS and deployment steps. Prepare hosting or Check readiness when offered. Wait for any running deployment to finish.'],
 ['Publish the saved website','Choose Publish saved website when it is enabled. Use Check deployment status if needed and wait for the site to become Live.'],
 ['Verify the public website','Open the live address and test navigation, forms, scripts, and recent edits. Recent releases shows the deployment history.']
 ],'The saved draft is available on the live website.'),
 g('analytics','publish','Read website traffic and Google reports','Choose a source, date range, and traffic breakdown.','analytics',[
 ['Open Analytics','Choose Analytics on the website’s dashboard card.'],
 ['Choose source and dates','Select Website traffic or Google Analytics and a 7, 30, or 90-day range. Use Refresh report for an updated view.'],
 ['Read the report','Review page views, visitors, daily page views, top pages, locations, and referral sources. Open Daily values when you need the chart’s individual numbers.'],
 ['Check tracking setup','Direct traffic needs a new published export and the website domain registered with the project. Google reports require a connected GA4 property. Editor and preview visits are excluded from direct tracking.']
 ],'You can understand visits over the selected period.','Dates use UTC. Website counts can include today; Google reports cover completed days. Sources can differ because of blockers, attribution, and processing delays.'),
 g('account','account','Manage your account and password','Update your profile, sign-in connections, and email preferences.','account',[
 ['Open My account','Choose My account in the workspace sidebar.'],
 ['Update your profile','Edit your Name and choose Save profile. The displayed email is read-only.'],
 ['Set or reset your password','In Security, request the password setup or reset email and follow its secure link. Connected sign-in controls let you connect your own supported account.'],
 ['Set optional emails','Choose whether to receive website tips and offers, then Save email preferences. Account and security messages are separate.']
 ],'Your profile and account preferences are updated.'),
 g('billing','account','Manage your plan and website slots','Find subscription details, website capacity, and billing controls.','billing',[
 ['Open Plans & billing','Choose Plans & billing in the workspace sidebar.'],
 ['Review current access','Check your plan, website slots, subscription status, and any trial or renewal date shown.'],
 ['Manage website capacity','Use the website slot controls to add capacity when you need another website. Adding pages to an existing website does not use another website slot.'],
 ['Use the offered billing controls','Follow the payment, invoice, or cancellation controls shown for your account. Read the confirmed amount and effective date before completing a change.']
 ],'You can manage the subscription associated with your websites.'),
 g('troubleshooting','account','Fix common editing and publishing problems','Work through selection, saving, image, AI, and DNS issues.','editor-overview',[
 ['Wrong properties or missing controls','Open Properties, choose Section, and select the exact object or section again. Use the element tree for overlapping objects. Open Sections if that panel is hidden.'],
 ['Changes are missing from the live website','Confirm the editor shows Saved, then publish the saved website. Wait for the deployment to complete and reload the public address. A test link can also need time to refresh.'],
 ['Image is cropped or not replaced','Select the exact image again. Review Size and Image fit. For generated images, check the progress/ready notification and confirm the intended target.'],
 ['AI is queued or has failed','Check the progress or content-ready notification. Read any error code, avoid duplicate submissions, and retry a focused request when appropriate.'],
 ['Domain or HTTPS is pending','Compare every DNS name and value with the records in your own publishing screen. Check for a domain appended twice, conflicting website records, and additional HTTPS TXT records. Run Check DNS records again after propagation.'],
 ['Ask support for help','Use Contact support and include the website name, page, steps to reproduce, and displayed error code. Include a screenshot of the problem with private keys and billing details removed.']
 ],'You have checked the most common causes and know what to send support.')
]
export function guideBySlug(slug: string) { return guides.find(guide => guide.slug === slug) }

export const guideScreenshots: Record<string, [string,string][]> = {
 'editor-tour': [['section-properties','Section properties and element tree'],['text-toolbar','The component selection toolbar']],
 'workspace-panels': [['editor-overview','Both editor panels open']],
 'add-page': [['page-picker','Find the generated page'],['page-properties','Review the new page properties']],
 'add-blog': [['page-picker','Select a blog page']],
 'add-section': [['section-layouts','Choose a specific layout instead']],
 'blank-section': [['blank-section','An empty section ready for your objects']],
 'section-properties': [['text-toolbar','Select an individual text component']],
 'select-components': [['section-properties','The element tree and full section controls']],
 'move-resize-layers': [['image-size','Image sizing and fit controls']],
 'replace-image': [['image-library','Choose from the project image library']],
 'theme': [['theme-palette','Site-wide colour palette'],['theme-typography','Typography and design tokens']],
 'logo-header-footer': [['header-properties','Global header content and navigation']],
 'ai-assistant': [['assistant-add','Additional assistant actions']],
 'contact-forms': [['form-properties','A selected form and its editable properties']],
 'site-seo': [['page-seo','Individual page SEO settings']],
 'responsive-preview': [['editor-overview','Desktop editor view']],
 'save-undo': [['publishing','Publish the saved website separately']],
}
