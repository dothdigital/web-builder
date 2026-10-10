import assert from 'node:assert/strict'
import {stageWorkCounter} from '../packages/pipeline/src/stage-work-counter'
assert.deepEqual(stageWorkCounter('IMAGES',{completed:18,total:24},null,'RUNNING'),{completed:18,total:24,unit:'images'})
assert.deepEqual(stageWorkCounter('CONTENT',{completed:3,total:10},null,'RUNNING'),{completed:3,total:10,unit:'pages'})
assert.deepEqual(stageWorkCounter('IMAGES',{generated:18,model:{pages:[{sections:Array.from({length:6},(_,i)=>({componentId:'Tpl_webtummy-business_12_1',props:{imageUrl:''},hidden:false}))}]}},null,'RUNNING'),{completed:18,total:24,unit:'images'})
assert.deepEqual(stageWorkCounter('CONTENT',{pageCount:10},{pages:Array(10)},'SUCCEEDED'),{completed:10,total:10,unit:'pages'})
assert.deepEqual(stageWorkCounter('IMAGES',{completed:4,total:0},null,'SUCCEEDED'),{completed:0,total:0,unit:'images'})
assert.deepEqual(stageWorkCounter('CONTENT',null,{pages:Array(10)},'RUNNING'),{completed:0,total:10,unit:'pages'})
assert.deepEqual(stageWorkCounter('COMPOSE',{completed:1,total:1},null,'RUNNING'),{})
console.log('PASS: live image/page counters, legacy checkpoints, initial totals and completed stages')
