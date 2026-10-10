import { z } from 'zod'
import { defineComponent } from '../types'
import { Section, Heading, Cta } from '../primitives'
import { ArticleBody } from './article-body'
import { SiteContentContainer } from './site-content-container'

export const serviceDetail = defineComponent({
  componentId:'ServiceDetail',version:'1.0.0',family:'ABOUT',name:'Service details',
  description:'Service information with a contact action and links to related services.',
  aiGuidance:'Use only supplied service facts. Preserve existing service paths.',
  propsSchema:z.object({heading:z.string(),body:z.string(),contentBlocks:z.array(z.object({heading:z.string(),body:z.string()})).default([]),faqs:z.array(z.object({question:z.string(),answer:z.string()})).default([]),contactHref:z.string().default('/contact'),related:z.array(z.object({label:z.string(),href:z.string()})).default([])}),
  editorFields:[{path:'/heading',label:'Heading',type:'text',headingLevel:2},{path:'/body',label:'Service information',type:'textarea'},{path:'/contentBlocks',label:'Service topics',type:'list'},{path:'/faqs',label:'Questions and answers',type:'list'},{path:'/contactHref',label:'Enquiry page',type:'link'},{path:'/related',label:'Related services',type:'list'}],
  tokenDeps:['palette.background','palette.foreground'],fixture:{heading:'Service information',body:'Supplied service information.',contentBlocks:[],faqs:[],contactHref:'/contact',related:[]},
  render:({props,context})=><Section>
    <style>{`.awb-service-columns{display:grid;grid-template-columns:minmax(0,1fr) minmax(180px, min(30%,320px));gap:clamp(24px,3vw,48px);align-items:start}.awb-service-columns>div,.awb-service-columns>aside{min-width:0;overflow-wrap:anywhere}.awb-service-columns aside a{display:block;line-height:1.5;text-decoration:none;padding:10px 12px;border-radius:6px}.awb-service-columns aside a:hover,.awb-service-columns aside a:focus-visible{background:var(--awb-bg)}@media(max-width:639px){.awb-service-columns{grid-template-columns:minmax(0,1fr)}}`}</style>
    <SiteContentContainer theme={context.templateTheme}>
      <div className="awb-service-columns">
        <div style={{display:'grid',gap:'1.5rem'}}><Heading level={2} style={{fontSize:'clamp(26px,3vw,36px)'}} data-awb-element="/heading">{props.heading}</Heading><ArticleBody text={props.body} path="/body"/>
          {props.contentBlocks.map((block,index)=>block.heading&&block.body?<section key={index} style={{display:'grid',gap:'1rem'}}><h3 data-awb-element={`/contentBlocks/${index}/heading`} style={{fontSize:'1.3rem',lineHeight:1.35,margin:0}}>{block.heading}</h3><ArticleBody text={block.body} path={`/contentBlocks/${index}/body`}/></section>:null)}
          {props.faqs.some(faq=>faq.question&&faq.answer)&&<section><h3 style={{fontSize:'1.3rem'}}>Questions about this service</h3>{props.faqs.map((faq,index)=>faq.question&&faq.answer?<details key={index} style={{borderBottom:'1px solid var(--awb-border)',padding:'1rem 0'}}><summary data-awb-element={`/faqs/${index}/question`} style={{cursor:'pointer',fontWeight:600}}>{faq.question}</summary><div style={{marginTop:'1rem'}}><ArticleBody text={faq.answer} path={`/faqs/${index}/answer`}/></div></details>:null)}</section>}
          <div style={{justifySelf:'start'}}><Cta label="Discuss your needs" href={props.contactHref.startsWith('/')?`${context.baseUrl}${props.contactHref}`:props.contactHref}/></div>
        </div>
        <aside><nav aria-label="Other services" style={{padding:'1.5rem',background:'var(--awb-surface)',border:'1px solid var(--awb-border)',borderRadius:'12px'}}><h2 style={{fontSize:'1.15rem',margin:'0 0 1rem'}}>Explore our services</h2><ul style={{listStyle:'none',padding:0,margin:0,display:'grid',gap:'0.35rem'}}>{props.related.map((link,index)=><li key={link.href}><a href={link.href} style={{color:'inherit'}} data-awb-element={`/related/${index}/label`}>{link.label}</a></li>)}</ul></nav></aside>
      </div>
    </SiteContentContainer>
  </Section>,
})
