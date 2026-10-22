import { GenerationStage, JobStatus, prisma, type Prisma } from '@awb/database'
import { stageCheckpoint, stageCheckpointResult } from './stage-checkpoint'
const toJson = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue

class StageError extends Error {
  constructor(
    readonly stage: GenerationStage,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message)
  }
}

/// Runs one stage as its own auditable, retryable unit of work. Every stage
/// writes a generation_jobs row before it starts, so the progress stream has
/// something to show even if the process dies mid-stage.
export async function runStage<T>(
  projectId: string,
  correlationId: string,
  stage: GenerationStage,
  input: Prisma.InputJsonValue,
  handler: (report: (completed: number, total: number, partialResult?: unknown) => Promise<void>, partialResult?: unknown) => Promise<{ output: Prisma.InputJsonValue; result: T; usage?: { model: string; inputTokens: number; outputTokens: number; costCents: number } }>,
): Promise<T> {
  const existing = await prisma.generationJob.findFirst({ where: { projectId, correlationId, stage } })
  const checkpoint = existing?.status === JobStatus.SUCCEEDED ? stageCheckpointResult(existing.output, stage) : undefined
  if (checkpoint) return checkpoint.result as T
  const job = existing
    ? await prisma.generationJob.update({
        where: { id: existing.id },
        data: { status: JobStatus.RUNNING, startedAt: new Date(), attempts: { increment: 1 }, errorMessage: null, finishedAt: null },
      })
    : await prisma.generationJob.create({
        data: {
          projectId,
          correlationId,
          stage,
          status: JobStatus.RUNNING,
          input,
          attempts: 1,
          startedAt: new Date(),
        },
      })

  try {
    const report = async (completed: number, total: number, partialResult?: unknown) => {
      await prisma.generationJob.update({ where: { id: job.id }, data: { output: toJson({ completed, total, ...(partialResult !== undefined ? { partialResult } : {}) }) } })
    }
    const { output, result, usage } = await handler(report, (existing?.output as { partialResult?: unknown } | null)?.partialResult)

    await prisma.generationJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.SUCCEEDED,
        output: toJson(stageCheckpoint(output, result)),
        finishedAt: new Date(),
        ...(usage
          ? {
              model: usage.model,
              inputTokens: usage.inputTokens,
              outputTokens: usage.outputTokens,
              costCents: usage.costCents,
            }
          : {}),
      },
    })

    return result
  } catch (error) {
    await prisma.generationJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.FAILED,
        errorMessage: error instanceof Error ? error.message : String(error),
        finishedAt: new Date(),
      },
    })

    throw new StageError(stage, `Stage ${stage} failed: ${error instanceof Error ? error.message : String(error)}`, error)
  }
}

