import assert from 'node:assert/strict'
import {savedStageResult} from '../packages/pipeline/src/saved-stage-result'
const pages=[{id:'home',path:'/'}]
const model={pages}
assert.deepEqual(savedStageResult('CONTENT',{pages}),{found:true,value:pages})
assert.deepEqual(savedStageResult('COMPOSE',{model}),{found:true,value:model})
assert.deepEqual(savedStageResult('IMAGES',{model,completed:8,total:46}),{found:true,value:model})
assert.deepEqual(savedStageResult('CONTENT',{completed:8,total:9}),{found:false},'A counter alone is not a saved copy result')
assert.deepEqual(savedStageResult('DESIGN_DNA',{dna:{id:'design'},tokens:{palette:{}}}),{found:true,value:{dna:{id:'design'},tokens:{palette:{}}}})
assert.deepEqual(savedStageResult('VALIDATE',{websiteVersionId:'version'}),{found:true,value:'version'})
assert.deepEqual(savedStageResult('VALIDATE',{stageResult:'version'}),{found:true,value:'version'})
assert.deepEqual(savedStageResult('IMAGES',null),{found:false})
console.log('PASS: completed stage recovery and incomplete checkpoint detection')
