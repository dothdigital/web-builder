'use client'
import {useState} from 'react'
import {useRouter} from 'next/navigation'
import {resumeWebsiteGeneration} from '@/app/actions/content-jobs'
import {ErrorNotice} from '@/components/error-notice'
export function ResumeGeneration({jobId}:{jobId:string}) {
 const router=useRouter()
 const [pending,setPending]=useState(false)
 const [error,setError]=useState<string>()
 return <div className="grid gap-2"><button type="button" className="wt-button" disabled={pending} onClick={async()=>{
  setPending(true);setError(undefined)
  try{const result=await resumeWebsiteGeneration(jobId);router.push(`/projects/${result.projectId}/progress?correlationId=${encodeURIComponent(result.correlationId)}`);router.refresh()}
  catch(caught){setError(caught instanceof Error?caught.message:'Could not resume generation.');setPending(false)}
 }}>{pending?'Resuming…':'Resume generation'}</button><p className="text-xs text-neutral-600">Continues unfinished work using saved pages, layout and images.</p>{error&&<ErrorNotice code="WT-CONTENT-001" message={error}/>}</div>
}
