// Read both current result checkpoints and legacy stage-specific output shapes.
export function savedStageResult(stage:string, output:unknown): {found:boolean;value?:unknown} {
 if (!output || typeof output !== 'object') return {found:false}
 const data=output as Record<string,unknown>
 if ('stageResult' in data) return {found:true,value:data.stageResult}
 if (stage === 'CONTENT') return Array.isArray(data.pages) ? {found:true,value:data.pages} : {found:false}
 if (stage === 'COMPOSE' || stage === 'IMAGES') return data.model ? {found:true,value:data.model} : {found:false}
 if (stage === 'VALIDATE') return typeof data.websiteVersionId === 'string' ? {found:true,value:data.websiteVersionId} : {found:false}
 if (stage === 'DESIGN_DNA') return data.dna && data.tokens ? {found:true,value:{dna:data.dna,tokens:data.tokens}} : {found:false}
 return {found:true,value:output}
}
