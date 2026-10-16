export const videos = [
 {id:'dashboard-tour',title:'Your dashboard and website actions',description:'Find your website and open the editor, analytics, publishing, and AI tools.',poster:'dashboard',guide:'dashboard'},
 {id:'add-page',title:'Add a page or blog post',description:'Choose a page type, write a clear brief, and configure an optional cover.',poster:'create-page',guide:'add-page'},
 {id:'add-section',title:'Add sections and objects',description:'Explore AI layouts, create a blank section, and add your first object.',poster:'add-object',guide:'add-section'},
 {id:'component-toolbar',title:'Select and style components',description:'Use the floating toolbar for text, spacing, borders, and movement.',poster:'text-toolbar',guide:'select-components'},
 {id:'right-properties',title:'Get to know Properties',description:'Tour the Section, Page, Theme, and Integrations tabs on the right.',poster:'section-properties',guide:'section-properties'},
 {id:'replace-image',title:'Replace and resize images',description:'Explore uploads, the image library, fit settings, and AI image controls.',poster:'replace-image',guide:'replace-image'},
] as const
export const guideVideo: Record<string,string> = {
 'dashboard':'dashboard-tour','editor-tour':'dashboard-tour',
 'add-page':'add-page','add-blog':'add-page',
 'add-section':'add-section','choose-section-layout':'add-section','blank-section':'add-section','add-objects':'add-section',
 'select-components':'component-toolbar','edit-text':'component-toolbar','spacing':'component-toolbar','borders-backgrounds':'component-toolbar','move-resize-layers':'component-toolbar',
 'section-properties':'right-properties','page-settings':'right-properties','page-seo':'right-properties','theme':'right-properties','site-seo':'right-properties',
 'replace-image':'replace-image','generate-image':'replace-image','image-size':'replace-image',
}
