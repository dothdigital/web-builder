const fs=require('node:fs')
const path=require('node:path')
const {JSDOM}=require('jsdom')

function compileDecorativeIcons(sections,library){
  const urls=new Set()
  function find(tree){
    if(!tree||typeof tree!=='object')return
    if(tree.tag==='img'&&typeof tree.attrs?.src==='string'&&/\/icons?\/.*\.svg$/i.test(tree.attrs.src))urls.add(tree.attrs.src)
    tree.children?.forEach(find)
  }
  sections.forEach(section=>find(section.tree))
  const names={class:'className',viewbox:'viewBox','xlink:href':'xlinkHref','xmlns:xlink':'xmlnsXlink','xml:space':'xmlSpace'}
  function compile(element){
    if(element.nodeType!==1||['script','style','foreignObject'].includes(element.localName))return null
    const attrs={}
    for(const attribute of element.attributes){
      if(/^on/i.test(attribute.name))continue
      if(attribute.name==='style'){
        const style={}
        for(const key of Array.from(element.style||[]))style[key.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=element.style.getPropertyValue(key)
        attrs.style=style
      }else{
        const key=names[attribute.name]||(/^data-|^aria-/.test(attribute.name)?attribute.name:attribute.name.replace(/-([a-z])/g,(_,c)=>c.toUpperCase()))
        attrs[key]=attribute.value
      }
    }
    return {tag:element.localName,attrs,children:Array.from(element.children).map(compile).filter(Boolean)}
  }
  const icons={}
  for(const url of urls){
    const file=path.join(library,url.replace(/^\/template-library\//,''))
    if(!fs.existsSync(file))continue
    const element=new JSDOM(fs.readFileSync(file,'utf8')).window.document.querySelector('svg')
    if(element)icons[url]=compile(element)
  }
  return icons
}
module.exports={compileDecorativeIcons}
if(require.main===module){
  const root=path.resolve(__dirname,'..')
  const layouts=require('../packages/component-registry/src/imported/layouts.json')
  const icons=compileDecorativeIcons(layouts.sections,path.join(root,'apps/web/public/template-library'))
  fs.writeFileSync(path.join(root,'packages/component-registry/src/imported/decorative-icons.json'),JSON.stringify(icons))
  console.log(`Compiled ${Object.keys(icons).length} palette-aware decorative icons`)
}
