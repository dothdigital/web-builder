import React from 'react'
import 'dotenv/config'
import JSZip from 'jszip'
import {prisma} from '@awb/database'
import {websiteModelSchema} from '@awb/website-model'
import {buildStaticExport} from '../apps/web/src/lib/static-export'
import {resolvePreviewAssets} from '../apps/web/src/lib/preview-assets'
Object.assign(globalThis,{React})
try{const sites=await prisma.hostingSite.findMany({where:{OR:[{previewDeployedReleaseId:{not:null}},{deployedReleaseId:{not:null}}]},select:{projectId:true,previewDeployedReleaseId:true,deployedReleaseId:true}});for(const site of sites)for(const [kind,id]of [['test',site.previewDeployedReleaseId],['live',site.deployedReleaseId]] as const){if(!id)continue;const release=await prisma.publishRelease.findUniqueOrThrow({where:{id}});const model=websiteModelSchema.parse(release.snapshot);const archive=await buildStaticExport(await resolvePreviewAssets(site.projectId,model),{siteUrl:'https://verification.example',preview:kind==='test'});const zip=await JSZip.loadAsync(archive);const pages=Object.keys(zip.files).filter(p=>p.endsWith('.html')).length;console.log(JSON.stringify({projectId:site.projectId,kind,pages,bytes:archive.length,result:'PASS'}))}}finally{await prisma.$disconnect()}
