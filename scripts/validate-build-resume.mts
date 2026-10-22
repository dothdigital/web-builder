import assert from 'node:assert/strict'
process.env.DATABASE_URL ||= 'postgresql://unused:unused@localhost/unused'
const { prisma, GenerationStage } = await import('../packages/database/src/index.ts')
const { runStage } = await import('../packages/pipeline/src/run-stage.ts')
const rows = new Map<string, any>()
let writes = 0
// Exercise the actual stage runner against an in-memory database boundary.
prisma.generationJob.findFirst = (async ({ where }: any) => rows.get(where.stage) ?? null) as any
prisma.generationJob.create = (async ({ data }: any) => { const row = { id: data.stage, ...data }; rows.set(data.stage, row); return row }) as any
prisma.generationJob.update = (async ({ where, data }: any) => { writes++; const row=rows.get(where.id); Object.assign(row, {...data, attempts: data.attempts?.increment ? row.attempts + data.attempts.increment : row.attempts}); return row }) as any
let calls = 0
const content = async () => { calls++; return { output: { completed: 2, total: 2 }, result: [{ id: 'home', text: 'saved copy' }] } }
const first = await runStage('project', 'run', GenerationStage.CONTENT, {}, content)
assert.equal(calls, 1)
const imageFailure = async () => { throw new Error('Provider interrupted') }
await assert.rejects(runStage('project', 'run', GenerationStage.IMAGES, {}, imageFailure), /Provider interrupted/)
assert.equal(rows.get('CONTENT').status, 'SUCCEEDED')
const before = writes
assert.deepEqual(await runStage('project', 'run', GenerationStage.CONTENT, {}, content), first)
assert.equal(calls, 1, 'completed content must not call the provider again')
assert.equal(writes, before, 'restoring a stage must not reset counters or attempts')
const restored = await runStage('project', 'run', GenerationStage.IMAGES, {}, async () => ({ output: { total: 1 }, result: { image: 'saved.png' } }))
assert.deepEqual(restored, { image: 'saved.png' })
assert.equal(rows.get('IMAGES').attempts, 2)
const version = await runStage('project', 'run', GenerationStage.VALIDATE, {}, async () => ({ output: { issues: [] }, result: 'version-1' }))
assert.equal(version, 'version-1')
assert.equal(await runStage('project', 'run', GenerationStage.VALIDATE, {}, async () => { throw Error('must not create a duplicate version') }), 'version-1')
console.log('PASS: interrupted stage retries; completed content/models/version IDs restored without provider calls or duplicate saves')
await prisma.$disconnect()
