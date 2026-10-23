import type { RenderContext } from '../types'
import { SiteContentContainer } from './site-content-container'
import { contactPropsSchema, renderContactForm } from './conversion'

export function TemplateEnquiry({values,context}:{values:Record<string,unknown>;context:RenderContext}) {
  const details=values.contactDetails as Record<string,string> | undefined
  const safeHref=(value:string|undefined)=>value && /^(?:tel:|mailto:|https?:\/\/)/i.test(value) ? value : undefined
  const heading=String(values.text1||'Send an enquiry')
  const form=contactPropsSchema.parse({heading,submitLabel:values.submitLabel||'Send enquiry',formFields:[{name:'name',label:'Name',type:'text',required:true},{name:'email',label:'Email',type:'email',required:true},{name:'phone',label:'Phone',type:'tel'},{name:'message',label:'Message',type:'textarea',required:true}]})
  return <section style={{padding:'clamp(32px,5vw,64px) 0',fontFamily:'var(--awb-body-font)',background:'var(--awb-bg)',color:'var(--awb-fg)'}}>
    <style>{'.awb-template-contact-details{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;margin-top:24px;padding-top:20px;border-top:1px solid var(--awb-border)}@media(max-width:639px){.awb-template-enquiry{grid-template-columns:1fr!important}.awb-template-contact-details{grid-template-columns:1fr}}'}</style>
    <SiteContentContainer theme={context.templateTheme}>
      <div className="awb-template-enquiry" style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)',gap:'clamp(12px,2.5vw,32px)',alignItems:'start'}}>
        <div data-awb-contact-image-panel="true" style={{minWidth:0,position:'relative',height:'clamp(280px,38vw,480px)',maxHeight:480,overflow:'hidden',borderRadius:16,background:'var(--awb-surface)'}}>
          {values.imageUrl?<img data-awb-element="/imageUrl" src={String(values.imageUrl)} alt={String(values.imageAlt||'')} style={{display:'block',position:'absolute',inset:0,width:'100%',height:'100%',maxHeight:'100%',objectFit:'cover'}}/>:<div style={{height:'100%',minHeight:240,background:'linear-gradient(135deg,var(--awb-primary),var(--awb-accent))'}}/>}
        </div>
        <div data-awb-contact-form-panel="true" style={{minWidth:0,padding:'clamp(12px,2.5vw,32px)',border:'1px solid var(--awb-border)',borderRadius:16,background:'var(--awb-surface)',overflowWrap:'anywhere'}}>
          {Boolean(values.text0)&&<p data-awb-element="/text0" style={{fontSize:'clamp(10px,1.3vw,15px)',fontWeight:600,letterSpacing:'.06em',textTransform:'uppercase',lineHeight:1.5,margin:'0 0 12px'}}>{String(values.text0)}</p>}
          <h2 data-awb-element="/text1" style={{fontSize:'clamp(20px,3vw,36px)',lineHeight:1.2,margin:'0 0 24px',fontFamily:'var(--awb-heading-font)'}}>{heading}</h2>
          {renderContactForm(form,context,'',{embedded:true,compact:true})}
          {details && <div className="awb-template-contact-details">
            {[[0,1,2,3,4,5],[6,7,8,9,10,11]].map((fields,index)=><div key={index} style={{minWidth:0,fontSize:14,lineHeight:1.6}}>
              <h3 data-awb-element={`/contactDetails/text${fields[0]}`} style={{fontSize:18,margin:'0 0 10px',fontWeight:650}}>{details[`text${fields[0]}`]}</h3>
              {fields.slice(1).map(field=>details[`text${field}`] ? <p key={field} data-awb-element={`/contactDetails/text${field}`} style={{margin:'4px 0'}}>{field === (index === 0 ? 2 : 8) && safeHref(details[`link${index}`]) ? <a href={safeHref(details[`link${index}`])} style={{color:'inherit'}}>{details[`text${field}`]}</a> : details[`text${field}`]}</p> : null)}
            </div>)}
          </div>}

        </div>
      </div>
    </SiteContentContainer>
  </section>
}
