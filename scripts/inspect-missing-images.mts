import 'dotenv/config'
import {prisma} from '@awb/database'
try {const v=await prisma.websiteVersion.findFirstOrThrow({where:{projectId:'cmveaqdzq003awhpa0cwv4dxt',kind:'DRAFT'},orderBy:{version:'desc'}});for(const p of (v.model as any).pages) console.log(JSON.stringify({path:p.path,sections:p.sections.map((s:any)=>({id:s.id,componentId:s.componentId,props:s.props}))}));}finally{await prisma.$disconnect()}
