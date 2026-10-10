import type { WebsiteModel } from '@awb/website-model'
import { importedSection } from './imported-layouts'

// Imported contact templates split the details, map and form into unrelated
// sections. Keep the selected page banner and use one functional contact layout.
export function ensureContactPageLayout(source: WebsiteModel): WebsiteModel {
  let changed=false
  const pages=source.pages.map(page=>{
    if (!/^\/(contact|contact-us|contactus|request-a-quote|quote)$/.test(page.path)) return page
    const contactSections=page.sections.filter(section=>!section.hidden&&importedSection(section.componentId)?.family==='CONTACT')
    if (!contactSections.some(section=>JSON.stringify(importedSection(section.componentId)?.tree).includes('"kind":"form"'))) return page
    // Leave manually rearranged objects intact until the user edits that layout.
    if(contactSections.some(section=>(section.props.freeElements as unknown[]|undefined)?.length||(section.props.removedElements as unknown[]|undefined)?.length||Object.keys((section.props.flowSlots||{}) as object).length||Object.keys((section.props.elementOffsets||{}) as object).length)) return page
    const first=contactSections[0]
    const form=contactSections.find(section=>JSON.stringify(importedSection(section.componentId)?.tree).includes('"kind":"form"'))!
    let serviceAreas=''
    for(const section of contactSections){
      for(const [key,value] of Object.entries(section.props)){
        if(typeof value==='string'&&/^(service areas|areas served)$/i.test(value.trim())){
          const next=section.props[`text${Number(key.replace('text',''))+1}`]
          if(typeof next==='string'&&next.trim()) serviceAreas=next
        }
      }
    }
    const contact=source.contact
    const address=contact.addressLine1 ? [contact.addressLine1,contact.addressLine2,contact.city,contact.region,contact.postalCode,contact.country].filter(Boolean).join(', ') : ''
    const replacement={id:first.id,componentId:'ContactSplit',componentVersion:'1.0.0',hidden:false,props:{
      heading:'Get in touch',intro:`Contact ${source.site.name} to discuss your questions and the services you are interested in.`,formHeading:String(form.props.text0||'Send an enquiry'),imageUrl:'',imageAlt:'',
      phone:contact.phone||'',email:contact.email||'',address,serviceAreas:serviceAreas||(!address?contact.city||'':''),
      hours:contact.hours.filter(entry=>!entry.closed).map(entry=>({day:entry.day,value:`${entry.opens}–${entry.closes}`})),
      formFields:[{name:'name',label:'Name',type:'text',required:true},{name:'email',label:'Email',type:'email',required:true},{name:'phone',label:'Phone',type:'tel'},{name:'message',label:'Message',type:'textarea',required:true}],
      submitLabel:String(form.props.submitLabel||'Send enquiry'),
    }}
    changed=true
    const ids=new Set(contactSections.map(section=>section.id))
    return {...page,sections:page.sections.flatMap(section=>section.id===first.id?[replacement]:ids.has(section.id)?[]:[section])}
  })
  return changed?{...source,pages}:source
}
