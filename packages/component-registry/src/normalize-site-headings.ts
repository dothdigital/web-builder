import type{WebsiteModel}from'@awb/website-model'
import{normalizeTemplateHeading}from'./imported-layouts'
export function normalizeSiteHeadings(model:WebsiteModel):WebsiteModel{
 return {...model,pages:model.pages.map(page=>({...page,sections:page.sections.map(section=>({...section,props:normalizeTemplateHeading(section.componentId,section.props)}))}))}
}
