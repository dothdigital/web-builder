import { websiteModelSchema, type WebsiteModel } from '@awb/website-model'

// Site-specific text uses only facts already supplied in this project's brief.
const details: Record<string, [string, string, string, Array<[string, string]>?]> = {
 '/': ['Insurance and Financial Planning | Secure Path', 'Explore insurance, investments and financial planning with Rupinder Singh at Secure Path. Serving Mississauga, Brampton, Toronto and the GTA.', 'insurance and financial planning', [
  ['What services does Secure Path offer?', 'Secure Path offers life, critical, visitor, Supervisa and travel insurance, plus investments, RRSP, RDSP, RESP, TFSA and estate planning enquiries.'],
  ['Who will I speak with?', 'Rupinder Singh is the licensed insurance agent and broker introduced on this website. Use the contact page to discuss the service you need.'],
  ['Which areas does Secure Path serve?', 'Secure Path serves Mississauga, Brampton, Toronto and the Greater Toronto Area. Contact Secure Path to enquire about availability in other Canadian provinces.'],
 ]],
 '/about': ['About Rupinder Singh and Secure Path', 'Meet Rupinder Singh, the licensed insurance agent and broker behind Secure Path. Learn about insurance and planning services across the GTA.', 'Rupinder Singh Secure Path', [
  ['Who is Rupinder Singh?', 'Rupinder Singh is the licensed insurance agent and broker introduced by Secure Path.'],
  ['How can I discuss my needs with Secure Path?', 'Use the contact page to send an enquiry about insurance, investments or planning. Include the service you want to discuss and your province.'],
 ]],
 '/insurance': ['Insurance Services | Secure Path', 'Explore life, critical, visitor, Supervisa and travel insurance with Secure Path. Send Rupinder Singh an enquiry about your insurance needs.', 'insurance services', [
  ['Which insurance services can I enquire about?', 'You can enquire about life insurance, critical insurance, visitor insurance, Supervisa insurance and travel insurance. Each service has a dedicated page on this website.'],
  ['How do I start an insurance enquiry?', 'Read the relevant insurance service page, then use the contact page to tell Secure Path which type of insurance you want to discuss and your province.'],
 ]],
 '/wealth-planning': ['Wealth and Financial Planning Services | Secure Path', 'Explore investments, RRSP, RDSP, RESP, TFSA and estate planning with Secure Path. Contact Rupinder Singh to discuss your planning needs.', 'wealth and financial planning services', [
  ['Which planning services does Secure Path cover?', 'Secure Path provides information and enquiries for investments, RRSP, RDSP, RESP, TFSA and estate planning.'],
  ['Where can I learn about a particular planning service?', 'Visit the dedicated page for the service you are interested in, then contact Secure Path with your questions and province.'],
 ]],
 '/contact': ['Contact Secure Path | Insurance and Planning Enquiries', 'Contact Secure Path to discuss insurance, investments or financial planning with Rupinder Singh. Include your service of interest and province.', 'contact Secure Path', [
  ['What should I include in my enquiry?', 'Tell Secure Path which insurance or planning service you are interested in and the province where you need assistance.'],
  ['Can I enquire about more than one service?', 'Yes. Mention the insurance, investment or planning services you would like to discuss in your message.'],
 ]],
 '/insurance/life-insurance': ['Life Insurance | Secure Path', 'Learn about life insurance with Secure Path. Contact Rupinder Singh to discuss your needs and ask questions about life insurance in your province.', 'life insurance'],
 '/insurance/critical-insurance': ['Critical Insurance | Secure Path', 'Explore critical insurance with Secure Path. Contact Rupinder Singh to discuss your needs and ask questions about the service in your province.', 'critical insurance'],
 '/insurance/visitor-insurance': ['Visitor Insurance for Canada | Secure Path', 'Explore visitor insurance for people visiting Canada with Secure Path. Contact Rupinder Singh to discuss your visit and insurance questions.', 'visitor insurance Canada'],
 '/insurance/supervisa-insurance': ['Supervisa Insurance | Secure Path', 'Explore Supervisa insurance with Secure Path. Contact Rupinder Singh to discuss your questions and the insurance needs for your planned visit.', 'Supervisa insurance'],
 '/insurance/travel-insurance': ['Travel Insurance | Secure Path', 'Explore travel insurance with Secure Path. Contact Rupinder Singh to discuss your trip and ask questions about your travel insurance needs.', 'travel insurance'],
 '/wealth-planning/investments': ['Investments and Planning | Secure Path', 'Explore investment planning with Secure Path. Contact Rupinder Singh to discuss your financial goals and ask questions about investment services.', 'investment planning'],
 '/wealth-planning/rrsp': ['RRSP Planning | Secure Path', 'Explore RRSP planning with Secure Path. Contact Rupinder Singh to discuss your long-term goals and ask questions about this planning service.', 'RRSP planning'],
 '/wealth-planning/rdsp': ['RDSP Planning | Secure Path', 'Explore RDSP planning with Secure Path. Contact Rupinder Singh to discuss your planning needs and ask questions about the RDSP service.', 'RDSP planning'],
 '/wealth-planning/resp': ['RESP Planning | Secure Path', 'Explore RESP planning for future education with Secure Path. Contact Rupinder Singh to discuss your goals and ask questions about the service.', 'RESP planning'],
 '/wealth-planning/tfsa': ['TFSA Planning | Secure Path', 'Explore TFSA planning with Secure Path. Contact Rupinder Singh to discuss your financial goals and ask questions about this planning service.', 'TFSA planning'],
 '/wealth-planning/estate-planning': ['Estate Planning | Secure Path', 'Explore estate planning with Secure Path. Contact Rupinder Singh to discuss your planning needs and ask questions about the estate planning service.', 'estate planning'],
}

export function prepareSecurePathSeo(input: WebsiteModel): WebsiteModel {
 const model = structuredClone(input)
 for (const page of model.pages) {
  const detail = details[page.path]
  if (!detail) throw new Error(`Review SEO for unexpected page: ${page.path}`)
  const [title, description, targetKeyword, faq] = detail
  page.seo = { ...page.seo, title, description, targetKeyword, canonical: page.seo.canonical || page.path }
  if (faq && !page.sections.some(section => section.componentId === 'FaqAccordion' && !section.hidden)) {
   const section = { id: 'page-faq', componentId: 'FaqAccordion', componentVersion: '1.0.0', hidden: false, props: { heading: 'Frequently asked questions', items: faq.map(([question, answer]) => ({ question, answer })) } }
   let index = page.sections.findIndex(section => section.componentId.startsWith('Cta'))
   if (index < 0) index = page.sections.length
   page.sections.splice(index, 0, section)
  }
 }
 return websiteModelSchema.parse(model)
}
