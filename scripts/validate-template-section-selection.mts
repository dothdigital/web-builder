import assert from 'node:assert/strict'
import { importedTemplates, templateContract, templateSelectionErrors } from '@awb/component-registry'
import { selectableLayouts } from '@awb/shared/layout-catalogue'

assert.equal(selectableLayouts.length, importedTemplates.length, 'Every imported theme is selectable')
for (const template of importedTemplates) {
  for (const path of ['/', '/about', '/services', '/services/example', '/contact']) {
    const contract = templateContract(template.id, path)
    assert.ok(contract.length, `${template.id} ${path} has generation sections`)
    const keep = new Set(['HERO', 'CONTACT'])
    const required = contract.filter(section => keep.has(section.family) && contract.find(other => other.family === section.family) === section)
    const extras = contract.filter(section => !required.includes(section)).slice(0, Math.max(0, 3 - required.length))
    const chosen = contract.filter(section => required.includes(section) || extras.includes(section)).map(section => section.componentId)
    assert.deepEqual(templateSelectionErrors(contract, [...chosen, 'FaqAccordion'], path), [], `${template.id} ${path} accepts a planned subset`)
    if (chosen.length > 1) assert.ok(templateSelectionErrors(contract, [...chosen].reverse().concat('FaqAccordion'), path).some(error => error.includes('order')))
    const hero = contract.find(section => section.family === 'HERO')
    if (hero) assert.ok(templateSelectionErrors(contract, [...chosen.filter(id => id !== hero.componentId), 'FaqAccordion'], path).some(error => error.includes('HERO')))
    assert.ok(templateSelectionErrors(contract, chosen, path).some(error => error.includes('FaqAccordion')))
  }
}
console.log(`PASS: ${importedTemplates.length} themes selectable; AI-planned section subsets validated for every page type.`)
