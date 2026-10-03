import assert from 'node:assert/strict'
import { StubAiProvider, OpenAiProvider, sitePlanSchema } from '@awb/ai'
const stub = new StubAiProvider({ seed: 'service-contract-check' })
const brief = { businessName: 'Example Business', description: 'A business providing two specialist services to its local customers.', services: ['First service', 'Second service'], goals: ['FORM'], tonePreferences: [], answers: {}, hasLogo: false, logoColors: [], uploadedImageUrls: [], testimonials: [] }
async function main() {
  const { data: analysis } = await stub.analyzeBrief(brief)
  const { data: directions } = await stub.proposeDesignDirections(brief, analysis)
  const { data: plan } = await stub.planSite(brief, analysis, directions.options[0]!.dna)
  sitePlanSchema.parse(plan)
  for (const service of brief.services) {
    const page = plan.pages.find((entry) => entry.serviceName === service)
    assert.ok(page)
    assert.ok(plan.navigation.flatMap((entry) => entry.children).some((entry) => entry.path === page.path))
  }
  const expanded = await stub.planSite({ ...brief, homepageLength: 'expanded' }, analysis, directions.options[0]!.dna)
  assert.ok(expanded.data.pages[0]!.sectionPlan.length >= 5 && expanded.data.pages[0]!.sectionPlan.length <= 6)
  assert.ok(plan.pages[0]!.sectionPlan.length >= 3 && plan.pages[0]!.sectionPlan.length <= 4)
  const originalFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => {
    calls += 1
    // A missing service must trigger repair, not silently pass validation.
    const data = calls === 1 ? { ...plan, pages: plan.pages.filter((page) => page.serviceName !== brief.services[0]) } : plan
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(data) } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }), { status: 200 })
  }
  try {
    const provider = new OpenAiProvider({ apiKey: 'test-only' })
    const result = await provider.planSite(brief, analysis, directions.options[0]!.dna)
    assert.equal(calls, 2)
    assert.equal(result.data.pages.filter((page) => page.serviceName).length, 2)
  } finally { globalThis.fetch = originalFetch }
  console.log('PASS: dedicated service pages, dropdown coverage, and automatic repair of omitted service pages (offline)')
}
void main()
