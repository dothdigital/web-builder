import 'dotenv/config'
import {prisma} from '@awb/database'
try{
const sites=await prisma.hostingSite.findMany({where:{OR:[{previewDeployedReleaseId:{not:null}},{deployedReleaseId:{not:null}}]},select:{projectId:true,previewDeployedReleaseId:true,deployedReleaseId:true}})
let checked=0,affected=0,gaps=0;const report=[]
for(const site of sites){for(const [kind,id]of [['test',site.previewDeployedReleaseId],['live',site.deployedReleaseId]] as const){if(!id)continue;const release=await prisma.publishRelease.findUnique({where:{id},select:{snapshot:true}});if(!release)continue;checked++;const model=release.snapshot as any;const missing=[];for(const page of model.pages??[])for(const s of page.sections??[]){if(s.hidden)continue;const p=s.props??{};if(s.componentId==='AboutSplitOverlap'&&!p.imageUrl?.trim())missing.push({page:page.path,section:s.id,field:'imageUrl'});if(['ServicesImageRail','ServicesAlternatingShowcase'].includes(s.componentId))for(const [i,item] of (p.items??[]).entries())if(!item.imageUrl?.trim())missing.push({page:page.path,section:s.id,field:`items/${i}/imageUrl`})}if(missing.length){affected++;gaps+=missing.length;report.push({projectId:site.projectId,kind,missing})}}}
console.log(JSON.stringify({checked,affected,gaps,report},null,2))
}finally{await prisma.$disconnect()}
