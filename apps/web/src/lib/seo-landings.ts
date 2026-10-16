export type WebsiteBuilderPage = {
  slug: string; label: string; title: string; description: string; heading: string; intro: string
  image: string; imageAlt: string; imageCaption: string
  problem: { heading: string; text: string }
  sections: { title: string; text: string }[]
  example: { heading: string; brief: string; pages: { name: string; content: string }[] }
  steps: string[]
  questions: { question: string; answer: string }[]
  guides: { slug: string; label: string }[]
}

// These are use cases supported by the editor and publishing workflow, not a
// search-volume ranking or a claim that these are completed customer projects.
export const WEBSITE_BUILDER_PAGES: WebsiteBuilderPage[] = [
  {
    slug: 'ai-website-builder', label: 'AI website builder',
    title: 'AI Website Builder for Small Business | Webtummy',
    description: 'Create a small business website with AI, edit your pages visually and publish on your domain. Webtummy brings content, SEO tools and hosting together.',
    heading: 'An AI website builder for small business.',
    intro: 'Turn what you know about your business into a website you can keep improving. Describe your services, review an AI-generated draft and make it yours with a visual editor.',
    image: 'new-website', imageAlt: 'Webtummy website creation screen for supplying a business brief', imageCaption: 'Actual Webtummy website creation screen, using the fictional Willow Studio demo workspace.',
    problem: { heading: 'Start with the business, then build the pages.', text: 'Your first website needs to answer a few practical questions: what do you offer, who is it for, and how can someone contact you? Webtummy uses your brief to help plan pages and draft their content. You supply the facts; AI gives you a starting point to review, rather than a reason to invent services or customer results.' },
    sections: [
      { title: 'Explain each service clearly', text: 'Use a dedicated page for a service that needs more explanation. Describe what is included, the information a customer should provide and the next step. Edit the wording directly or ask the AI Assistant for a focused revision.' },
      { title: 'Give enquiries a clear destination', text: 'Add a contact form and edit its field labels, required fields and submission behaviour. Use buttons to lead visitors to the right page. Test the form after publishing so an interested visitor has a working way to reach you.' },
      { title: 'Manage the website after launch', text: 'Update page titles and descriptions, publish new content and review traffic reports from the same workspace. A custom domain and managed hosting keep publishing connected to the website you are editing.' },
    ],
    example: { heading: 'A service business website brief', brief: 'Create a website for a small bookkeeping business. We offer monthly bookkeeping, invoice organisation and management reports. Our customers are independent business owners. Use a clear, reassuring tone and make the main action “Ask about bookkeeping”. Do not invent qualifications or testimonials.', pages: [
      { name: 'Home', content: 'Introduce the bookkeeping offer, explain who it helps and link to the services and contact pages.' },
      { name: 'Monthly bookkeeping', content: 'Describe the actual monthly tasks, what the customer supplies and how to ask about availability.' },
      { name: 'Contact', content: 'Collect the visitor’s name, email and a short description of the help they need.' },
    ] },
    steps: ['Describe your real services and upload the brand assets you already own.', 'Review the generated pages, replace any incomplete details and test the contact journey.', 'Preview mobile and desktop, connect your domain and publish the saved website.'],
    questions: [
      { question: 'Can I change the AI-generated website?', answer: 'Yes. Edit text and layout visually, update images and colours, or ask the AI Assistant for changes. Review its changes before saving and publishing.' },
      { question: 'Are SEO tools and hosting included?', answer: 'The Individual plan includes page SEO controls and managed hosting for one website. These tools help you configure your site; search rankings and indexing are determined by search engines.' },
      { question: 'What does Webtummy cost?', answer: 'The Individual plan is US$29 per month for one website. Eligible new customers receive a 7-day free trial. A card is required and billing begins after the trial unless you cancel beforehand.' },
    ], guides: [{ slug: 'new-website', label: 'See the website creation workflow' }, { slug: 'contact-forms', label: 'Configure a contact form' }, { slug: 'publish', label: 'Publish your saved website' }],
  },
  {
    slug: 'website-builder-for-entrepreneurs', label: 'For entrepreneurs',
    title: 'Website Builder for Entrepreneurs | Webtummy',
    description: 'Give your business idea a website with Webtummy. Draft your offer with AI, edit the pages yourself and publish a focused site with content and hosting.',
    heading: 'A website builder for entrepreneurs ready to launch.',
    intro: 'Make your offer understandable before making your website bigger. Build a focused first version, explain what you are launching and give visitors a practical next step.',
    image: 'create-page', imageAlt: 'Webtummy page creation form with topic, audience and content controls', imageCaption: 'Actual Webtummy page creation controls in the fictional Willow Studio demo workspace.',
    problem: { heading: 'Give the first version one clear job.', text: 'An early business website can introduce an offer, answer the questions buyers ask and invite an enquiry. Webtummy helps you draft that starting point from a business brief. You can add pages later as you learn what people need to understand, without rebuilding your whole website around every new idea.' },
    sections: [
      { title: 'Turn an offer into a page', text: 'Define the audience, problem, service or product description and desired action. Use those details when creating a page with AI. Read the generated copy closely so your first visitors see an accurate offer rather than a list of unconfirmed promises.' },
      { title: 'Keep new content connected', text: 'Create another page or a blog post from the editor when you have something useful to explain. Give it a clear title and link it from relevant pages so visitors can follow the story from introduction to enquiry.' },
      { title: 'Learn from actual visits', text: 'After publishing, use the analytics view to inspect page visits and referrals. Treat traffic as information to review alongside customer conversations. Website analytics do not prove product-market fit or guarantee sales.' },
    ],
    example: { heading: 'A focused first-offer brief', brief: 'Build a website for an entrepreneur offering a live online workshop on organising a first business budget. Explain the workshop topics and who it is for. Include an enquiry form for future dates. Do not invent dates, attendee numbers or results.', pages: [
      { name: 'Workshop overview', content: 'Describe the budget planning topics and the type of business owner who may find them useful.' },
      { name: 'About the organiser', content: 'Use the founder’s actual background, photo and reasons for creating the workshop.' },
      { name: 'Ask about a workshop', content: 'Collect an enquiry about availability. Add a link to an existing registration service if one is supplied.' },
    ] },
    steps: ['Write down one audience, one offer and the action you want a visitor to take.', 'Generate and edit the first pages, using only confirmed details and your own assets.', 'Publish, review feedback and create additional pages when they answer a real visitor question.'],
    questions: [
      { question: 'Can I add pages after my first launch?', answer: 'Yes. The editor supports creating new pages and blog content. Review the draft, add the right navigation links and publish the saved update.' },
      { question: 'Can I connect an existing registration or payment link?', answer: 'You can set a button’s destination to a supplied external URL. The linked service handles its own registration or payment process; check that destination before publishing.' },
      { question: 'Do I need finished branding to begin?', answer: 'You can start with a business brief and refine colours, fonts, images and text in the editor. Use assets you have permission to publish and check that the final site accurately represents the business.' },
    ], guides: [{ slug: 'add-page', label: 'Create a new page' }, { slug: 'buttons-links', label: 'Set a button destination' }, { slug: 'analytics', label: 'Read website traffic' }],
  },
  {
    slug: 'no-code-website-builder', label: 'No-code website builder',
    title: 'No Code Website Builder with AI Editing | Webtummy',
    description: 'Build and update a website without writing code. Edit text, sections, images and styles visually, use AI for changes and preview before publishing.',
    heading: 'A no code website builder you can keep editing.',
    intro: 'Change the website on the screen instead of starting with a code editor. Select text, images, buttons or sections, then use the controls that belong to that selection.',
    image: 'editor-overview', imageAlt: 'Webtummy visual editor with page canvas, section panel and properties controls', imageCaption: 'The real Webtummy visual editor showing the fictional Willow Studio example website.',
    problem: { heading: 'Make everyday updates yourself.', text: 'A website is rarely finished after the first launch. A service changes, a photo needs replacing or a button should lead somewhere new. Webtummy provides visual controls for those everyday edits, alongside an AI Assistant for describing a change in words. You still choose what to keep and what to publish.' },
    sections: [
      { title: 'Work on a specific object', text: 'Select an element on the canvas and use its properties to adjust content or appearance. Text editing, image replacement, button destinations and spacing each have dedicated controls. The available fields depend on the object you select.' },
      { title: 'Shape a complete page', text: 'Use the sections panel to move through the page, add supported sections and adjust layout. Theme controls let you work on shared colours and typography. Review shared changes because they may affect more than the current page.' },
      { title: 'Check before going live', text: 'Switch between desktop, tablet and mobile previews. Save your edits and use undo or redo when needed. Publishing is a separate step, which lets you inspect the saved draft before replacing the live version.' },
    ],
    example: { heading: 'A practical editing example', brief: 'On the current service page, change the main button to “Ask about availability”, link it to the contact page, replace the hero photo with my uploaded image and make the introduction shorter. Keep the service details unchanged.', pages: [
      { name: 'Select', content: 'Choose the button or image on the canvas so the properties panel shows the correct element.' },
      { name: 'Edit', content: 'Set the button label and destination, select an uploaded image and review the revised introduction.' },
      { name: 'Preview', content: 'Check the image crop and button on mobile, follow the link and publish only after saving the final version.' },
    ] },
    steps: ['Generate a starting website from your brief or open your existing Webtummy draft.', 'Use visual controls or a focused AI request to change the relevant page element.', 'Preview, save and publish; repeat whenever your content changes.'],
    questions: [
      { question: 'Do I need HTML or CSS for ordinary edits?', answer: 'No. The visual editor provides controls for supported text, images, layouts and styling. Advanced custom requirements depend on what the editor and supported integrations can do.' },
      { question: 'Can I undo a change?', answer: 'The editor provides undo and redo. Save the version you want to keep, and check the preview before publishing.' },
      { question: 'Can I ask AI to edit only part of a page?', answer: 'Yes. The AI Assistant can work on the current page or selected content. Give it a specific request and review the result, especially for shared sections such as headers.' },
    ], guides: [{ slug: 'editor-tour', label: 'Tour the visual editor' }, { slug: 'ai-assistant', label: 'Use the AI Assistant' }, { slug: 'responsive-preview', label: 'Check responsive previews' }],
  },
  {
    slug: 'website-builder-for-consultants', label: 'For consultants',
    title: 'AI Website Builder for Consultants | Webtummy',
    description: 'Explain your consulting services, show genuine experience and collect enquiries. Build and edit your consultant website with AI, SEO tools and hosting.',
    heading: 'An AI website builder for consultants with something to explain.',
    intro: 'Help a potential client understand the problem you solve, how an engagement works and whether your experience fits their needs. Build service pages around those decisions.',
    image: 'page-seo', imageAlt: 'Webtummy page SEO settings for editing a search title and description', imageCaption: 'Real page SEO controls in Webtummy, captured with the fictional Willow Studio demo website.',
    problem: { heading: 'Make expertise easier to assess.', text: 'A consulting website needs more than a broad promise to help businesses grow. Separate the services you actually provide, explain your process and use evidence you are allowed to share. Webtummy can help draft and organise these pages; your experience, credentials and client permissions remain the source of truth.' },
    sections: [
      { title: 'Describe the engagement', text: 'Create a page for each distinct service. Explain who it suits, the work involved and what a prospective client should bring to a first conversation. Keep deliverables specific without making promises about outcomes you cannot substantiate.' },
      { title: 'Use real work and credentials', text: 'Portfolio and credential sections support supplied project descriptions, images and links. Publish a client name, certification or outcome only when it is accurate and you have permission. A clear account of your approach is useful even when client work is confidential.' },
      { title: 'Publish useful explanations', text: 'Use pages or blog posts to answer recurring questions about your work. Set a meaningful search title and description for each page, then connect it to the relevant service and enquiry action.' },
    ],
    example: { heading: 'An operations consulting brief', brief: 'Create a website for an independent operations consultant offering process reviews and workflow documentation. Explain the review process and invite prospects to describe their bottleneck. Use only the background and project information I supply. Do not invent certifications or efficiency improvements.', pages: [
      { name: 'Process review', content: 'Explain the discovery conversation, materials reviewed and the deliverables that are actually included.' },
      { name: 'Approach and experience', content: 'Describe the consultant’s real background and include approved project examples if available.' },
      { name: 'Discuss a project', content: 'Use an enquiry form to ask about the prospect’s challenge and what they want help documenting.' },
    ] },
    steps: ['List your actual consulting offers and the evidence you can publish.', 'Draft separate service pages and edit them for accuracy, scope and clarity.', 'Connect each service to an enquiry form or your existing appointment link, then test and publish.'],
    questions: [
      { question: 'Can I give each consulting service its own page?', answer: 'Yes. You can create and edit separate pages, set their SEO details and add them to the navigation.' },
      { question: 'Can I link to my scheduling tool?', answer: 'Yes. Set a button to your existing appointment URL. Scheduling and availability are managed by that external service.' },
      { question: 'Can I show case studies without naming clients?', answer: 'You can publish descriptions and images you are authorised to share, including anonymised work where appropriate. Review the content yourself; AI cannot establish permission or verify confidential client facts.' },
    ], guides: [{ slug: 'portfolio-credentials', label: 'Add real work and credentials' }, { slug: 'page-seo', label: 'Edit page SEO' }, { slug: 'contact-forms', label: 'Configure an enquiry form' }],
  },
  {
    slug: 'restaurant-website-builder', label: 'For restaurants',
    title: 'AI Restaurant Website Builder | Webtummy',
    description: 'Create a restaurant website with your menu content, food photos and contact details. Edit with AI and link to your existing booking or ordering service.',
    heading: 'A restaurant website builder for your food and your story.',
    intro: 'Give diners a clear place to read your menu, see your own food photos and choose the next step. Use Webtummy for the website and link to the booking or ordering service you already use.',
    image: 'text-toolbar', imageAlt: 'Webtummy text editing toolbar for changing website content directly on the page', imageCaption: 'Actual text editing controls in the fictional Willow Studio demo; this is a product screenshot, not a restaurant customer site.',
    problem: { heading: 'Keep the information diners need easy to read.', text: 'A restaurant’s website can introduce the food, explain the offer and present current menu information. Start with accurate names, descriptions and prices, then check how they read on a phone. Webtummy supports editable website pages, images, text and links; this use case is a restaurant information website.' },
    sections: [
      { title: 'Publish readable menu content', text: 'Use headings and text to organise your actual dishes, descriptions and supplied prices on a page. Review every update before publishing. Confirm dietary and allergen statements yourself rather than asking AI to infer them from a dish name or photograph.' },
      { title: 'Use photographs of your own food', text: 'Upload images you have the right to use and replace them through the image controls. A real dish photo gives diners a more accurate expectation than an unrelated stock image. Add descriptive alternative text and check the crop on mobile.' },
      { title: 'Connect the next step', text: 'Set buttons to an existing reservation or ordering URL, or use a contact form for general enquiries. Webtummy does not provide a native table-availability system, point of sale or food-ordering checkout. Those transactions remain with the service you link to.' },
    ],
    example: { heading: 'A restaurant information-site brief', brief: 'Build a website for an independent restaurant. I will supply the restaurant name, menu, prices and food photos. Create Home, Menu, Our Story and Contact pages. Add “View menu” as the main action. Add a reservation link only when I provide its URL. Do not invent dishes or dietary claims.', pages: [
      { name: 'Menu', content: 'Use the supplied dish names, descriptions and prices as editable page content, grouped under clear headings.' },
      { name: 'Our story', content: 'Tell the owner’s actual story and show original food or interior photographs with permission.' },
      { name: 'Contact and reservations', content: 'Provide the supplied contact options and link to an existing booking service when one is available.' },
    ] },
    steps: ['Collect your current menu text, approved prices and original photos.', 'Create and edit the pages, then check menu readability and image crops on a phone.', 'Test any external booking or ordering link and publish the reviewed website.'],
    questions: [
      { question: 'Can I update dishes and prices myself?', answer: 'Yes. When the menu is published as page text, you can edit its content in the visual editor, save it and publish the update.' },
      { question: 'Does Webtummy manage restaurant orders or table availability?', answer: 'No. Use it to build the restaurant website and link to your existing ordering or reservation service. That service manages the transaction and availability.' },
      { question: 'Will AI create accurate dietary or allergen labels?', answer: 'You must supply and verify those details. Do not rely on AI to determine ingredients, allergens or suitability for a dietary requirement.' },
    ], guides: [{ slug: 'edit-text', label: 'Edit website text' }, { slug: 'replace-image', label: 'Replace an image' }, { slug: 'buttons-links', label: 'Link to an external service' }],
  },
  {
    slug: 'freelancer-website-builder', label: 'For freelancers',
    title: 'AI Website Builder for Freelancers | Webtummy',
    description: 'Build a freelance portfolio website with AI. Present real projects, explain your services and collect enquiries with visual editing and managed hosting.',
    heading: 'An AI website builder for freelancers and their work.',
    intro: 'Bring selected projects, your services and a way to contact you into one portfolio website. Show the work you can share and explain the role you played in it.',
    image: 'add-section', imageAlt: 'Webtummy section library for adding supported website sections', imageCaption: 'Actual Webtummy section controls, shown in the fictional Willow Studio demo workspace.',
    problem: { heading: 'Help the right client understand your work.', text: 'A freelance website should make it easy to see what you do and why a project is relevant. A gallery alone may not explain your contribution. Use Webtummy’s portfolio sections and editable pages to pair approved visuals with a concise description of the brief, your role and the finished deliverable.' },
    sections: [
      { title: 'Present selected projects', text: 'Add supplied work to a portfolio section with a title, category, image, description and optional link. Use the projects you are allowed to publish. Keep client identities and private materials out when your agreement does not permit sharing them.' },
      { title: 'Explain what you offer now', text: 'Describe services separately from past work. A writer might explain articles and editorial support; a designer might explain identity design and presentation work. Set expectations about the information you need for a new enquiry without inventing prices or turnaround guarantees.' },
      { title: 'Keep your portfolio current', text: 'Replace older images, revise service copy and add a new page as your practice changes. Review the desktop and mobile versions, then publish the saved update. Your portfolio can evolve without starting over with a new website.' },
    ],
    example: { heading: 'A freelance design portfolio brief', brief: 'Create a portfolio website for a freelance presentation designer. I will supply three projects and the images I have permission to share. Show the brief, my role and the deliverables for each. Explain presentation design and template services, then invite project enquiries. Do not invent client names or testimonials.', pages: [
      { name: 'Selected work', content: 'Show the three supplied projects with approved imagery and an explanation of the designer’s contribution.' },
      { name: 'Services', content: 'Describe the actual presentation and template services, what a client supplies and how to discuss scope.' },
      { name: 'Project enquiry', content: 'Ask for contact details and a short project description, then explain how the freelancer will respond.' },
    ] },
    steps: ['Choose a small set of real projects and confirm which images and details you can share.', 'Create your portfolio and service pages, adding factual descriptions and a contact action.', 'Check image quality and mobile presentation, connect your domain and publish.'],
    questions: [
      { question: 'Can I add project images and links?', answer: 'Yes. Portfolio sections support supplied images, descriptions, categories and optional destination links. You can edit those items in the properties panel.' },
      { question: 'What if I cannot publish client work?', answer: 'Explain your services and process, and use your own work or approved anonymised examples. Label personal or demonstration projects accurately rather than presenting them as client commissions.' },
      { question: 'Can a visitor send a project enquiry?', answer: 'Yes. Add a contact form and configure the fields and submission behaviour. Test it on the published website before relying on it for new enquiries.' },
    ], guides: [{ slug: 'portfolio-credentials', label: 'Add portfolio projects' }, { slug: 'contact-forms', label: 'Add an enquiry form' }, { slug: 'responsive-preview', label: 'Preview on different screens' }],
  },
]

export function websiteBuilderPage(slug: string) {
  return WEBSITE_BUILDER_PAGES.find(page => page.slug === slug)
}
