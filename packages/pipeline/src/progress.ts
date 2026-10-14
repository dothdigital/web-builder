import { JobStatus, prisma } from '@awb/database'
import { generationStages, stageDescriptor } from './stages'

export interface StageProgress {
  stage: string
  label: string
  activity: string
  status: JobStatus | 'PENDING'
  attempts: number
  errorMessage?: string
  startedAt?: string
  finishedAt?: string
  note?: string
}

export interface GenerationProgress {
  correlationId: string
  projectId: string
  percent: number
  currentStage?: StageProgress
  stages: StageProgress[]
  status: 'pending' | 'running' | 'succeeded' | 'failed'
}

/// Progress is derived from generation_jobs rather than kept in memory, so the
/// UI shows the same truth after a refresh, a worker restart or a retry.
export async function getGenerationProgress(
  projectId: string,
  correlationId: string,
): Promise<GenerationProgress> {
  const jobs = await prisma.generationJob.findMany({
    where: { projectId, correlationId },
    orderBy: { createdAt: 'asc' },
  })

  const byStage = new Map(jobs.map((job) => [job.stage, job]))
  const contentJob = await prisma.contentJob.findFirst({ where: { id: correlationId, projectId }, select: { input: true, status: true, error: true } })
  const rerun = (contentJob?.input as { rerun?: { scope?: string } } | null)?.rerun
  const descriptors = rerun && rerun.scope !== 'FULL'
    ? generationStages.filter(entry => entry.stage === 'VALIDATE' || entry.stage === (rerun.scope === 'CONTENT' ? 'CONTENT' : 'IMAGES'))
    : generationStages
  const totalStageWeight = descriptors.reduce((total, entry) => total + entry.weight, 0)

  const stages: StageProgress[] = descriptors.map((descriptor) => {
    const job = byStage.get(descriptor.stage)
    const output = job?.output as { referenceMessage?: unknown } | null | undefined

    return {
      stage: descriptor.stage,
      label: descriptor.label,
      activity: descriptor.activity,
      status: job?.status ?? (contentJob?.status === 'FAILED' && descriptor.stage === 'VALIDATE' ? JobStatus.FAILED : 'PENDING'),
      attempts: job?.attempts ?? 0,
      ...(typeof output?.referenceMessage === 'string' ? { note: output.referenceMessage } : {}),
      ...(job?.errorMessage ? { errorMessage: job.errorMessage } : !job && descriptor.stage === 'VALIDATE' && contentJob?.status === 'FAILED' ? { errorMessage: contentJob.error ?? 'The update could not finish. Please try again.' } : {}),
      ...(job?.startedAt ? { startedAt: job.startedAt.toISOString() } : {}),
      ...(job?.finishedAt ? { finishedAt: job.finishedAt.toISOString() } : {}),
    }
  })

  const completedWeight = stages
    .filter((entry) => entry.status === JobStatus.SUCCEEDED)
    .reduce((total, entry) => total + (stageDescriptor(entry.stage as never)?.weight ?? 0), 0)

  const failed = stages.some((entry) => entry.status === JobStatus.FAILED)
  const running = stages.find((entry) => entry.status === JobStatus.RUNNING)
  const allDone = stages.every((entry) => entry.status === JobStatus.SUCCEEDED)

  return {
    correlationId,
    projectId,
    percent: Math.round((completedWeight / totalStageWeight) * 100),
    ...(running ? { currentStage: running } : {}),
    stages,
    status: failed ? 'failed' : allDone ? 'succeeded' : jobs.length > 0 ? 'running' : 'pending',
  }
}
