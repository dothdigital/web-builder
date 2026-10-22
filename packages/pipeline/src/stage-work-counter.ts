import { emptyImagePointers } from '@awb/component-registry'
import type { WebsiteModel } from '@awb/website-model'
export function stageWorkCounter(stage:string, raw:unknown, input:unknown, status?:string): {completed?:number;total?:number;unit?:'images'|'pages'} {
  const output = raw as {completed?:number;total?:number;generated?:number;pageCount?:number;model?:WebsiteModel} | null
  const request = input as {pages?:unknown[]} | null
  if (stage !== 'IMAGES' && stage !== 'CONTENT') return {}
  const unit = stage === 'IMAGES' ? 'images' : 'pages'
  if (typeof output?.total === 'number' && Number.isFinite(output.total) && output.total >= 0) return {completed:Math.min(output.total,Math.max(0,output.completed ?? 0)),total:output.total,unit}
  // Read counters from older checkpoints, including runs that were already
  // in progress when explicit counters were added.
  if (stage === 'IMAGES' && typeof output?.generated === 'number') {
    const missing = output.model?.pages.reduce((sum,page)=>sum+page.sections.filter(section=>!section.hidden).reduce((count,section)=>count+emptyImagePointers(section.componentId,section.props).length,0),0)
    if (typeof missing === 'number') return {completed:output.generated,total:output.generated+missing,unit}
    if (status === 'SUCCEEDED') return {completed:output.generated,total:output.generated,unit}
  }
  if (stage === 'CONTENT') {
    const total = request?.pages?.length ?? output?.model?.pages.length ?? output?.pageCount
    if (typeof total === 'number') return {completed:status === 'SUCCEEDED' ? total : 0,total,unit}
  }
  return {}
}
