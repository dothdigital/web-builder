import assert from 'node:assert/strict'
import {getComponent} from '@awb/component-registry'
import {addManualObject,selectedObjectColumn} from '../apps/web/src/lib/add-manual-object'
const section:any={id:'selected',componentId:'ManualSection',componentVersion:'1.0.0',hidden:false,props:{sectionColumns:5,items:[{id:'existing',kind:'text',column:4,text:'Keep this'}]}}
for(const [pointer,column] of [['/columnSlots/3',3],['/items/0',4],['/items/0/text',4],['/items/99',1],[undefined,1]] as const){
 const target=selectedObjectColumn(section.props,pointer)
 assert.equal(target,column)
 const added=addManualObject(section,'image','new-'+column,400,{column:target})
 assert.equal((added.section.props.items as any[])[1].column,column)
 assert.equal(added.section.id,'selected');assert.equal(added.path,'/items/1')
 assert.deepEqual(section.props.items,[{id:'existing',kind:'text',column:4,text:'Keep this'}])
 getComponent('ManualSection')!.propsSchema.parse(added.section.props)
}
assert.throws(()=>addManualObject(section,'text','bad',400,{column:6}),/Choose a column/)
for(const id of ['HeaderSplitUtility','FooterCompact','ServicesLargeNumbers']){
 const definition=getComponent(id)!,base:any={id,componentId:id,componentVersion:definition.version,hidden:false,props:definition.fixture}
 const added=addManualObject(base,'text','nested',100)
 assert.equal(added.section.id,id);assert.equal((added.section.props.freeElements as any[]).length,1)
 definition.propsSchema.parse(added.section.props)
}
console.log('PASS: selected column frames and child objects determine insertion column; original content stays intact; invalid columns rejected; designed sections and shared chrome keep their destination.')
